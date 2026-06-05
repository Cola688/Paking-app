const DEVTOOLS_BASE_URL = 'http://127.0.0.1:7003/app/api/v1';
const DEVICE_BASE_URL = 'http://127.0.0.1:7003/app/api/v1';

const getDefaultBaseUrl = () => {
  try {
    const platform = wx.getSystemInfoSync().platform;
    return platform === 'devtools' ? DEVTOOLS_BASE_URL : DEVICE_BASE_URL;
  } catch (e) {
    return DEVTOOLS_BASE_URL;
  }
};

const getAppData = () => {
  try {
    const app = getApp();
    return app && app.globalData ? app.globalData : { baseUrl: getDefaultBaseUrl() };
  } catch (e) {
    return { baseUrl: getDefaultBaseUrl() };
  }
};

const decodeArrayBuffer = (buffer) => {
  if (!buffer) {
    return '';
  }

  if (typeof TextDecoder !== 'undefined') {
    return new TextDecoder('utf-8').decode(buffer);
  }

  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }

  try {
    return decodeURIComponent(escape(binary));
  } catch (e) {
    return binary;
  }
};

class Request {
  constructor() {
    const globalData = getAppData();
    this.baseUrl = globalData.baseUrl || getDefaultBaseUrl();
    this.header = {
      'Content-Type': 'application/json'
    };
    this.unauthorizedPrompting = false;
  }

  request(options) {
    const { url, method = 'GET', data, needToken = true } = options;
    const globalData = getAppData();
    this.baseUrl = globalData.baseUrl || getDefaultBaseUrl();
    
    const header = { ...this.header };
    let requestToken = '';
    if (needToken) {
      try {
        const token = wx.getStorageSync('token');
        if (token) {
          requestToken = token;
          header['Authorization'] = token;
        }
      } catch (e) {}
    }

    return new Promise((resolve, reject) => {
      wx.showLoading({ title: '加载中...', mask: true });
      
      wx.request({
        url: `${this.baseUrl}${url}`,
        method,
        data,
        header,
        timeout: 10000,
        success: (res) => {
          wx.hideLoading();
          
          if (res.statusCode === 200) {
            if (res.data.code === 0 || res.data.code === 200) {
              resolve(res.data);
            } else if (res.data.code === 401) {
              this.handleUnauthorized(requestToken);
              reject(res.data);
            } else {
              wx.showToast({ title: res.data.msg || res.data.message || '请求失败', icon: 'none' });
              reject(res.data);
            }
          } else if (res.statusCode === 401 || res.data?.code === 401) {
            this.handleUnauthorized(requestToken);
            reject(res.data || { message: '登录已过期' });
          } else {
            wx.showToast({ title: res.data?.msg || res.data?.message || '网络错误', icon: 'none' });
            reject(res.data);
          }
        },
        fail: (err) => {
          wx.hideLoading();
          wx.showToast({ title: '网络连接失败', icon: 'none' });
          reject(err);
        }
      });
    });
  }

  stream(options) {
    const {
      url,
      method = 'POST',
      data,
      needToken = true,
      onFrame
    } = options;

    const globalData = getAppData();
    this.baseUrl = globalData.baseUrl || getDefaultBaseUrl();

    const header = {
      ...this.header,
      Accept: 'text/event-stream'
    };
    let requestToken = '';
    if (needToken) {
      try {
        const token = wx.getStorageSync('token');
        if (token) {
          requestToken = token;
          header.Authorization = token;
        }
      } catch (e) {}
    }

    const stream = {
      requestTask: null,
      abort() {
        if (this.requestTask) {
          this.requestTask.abort();
        }
      }
    };

    stream.promise = new Promise((resolve, reject) => {
      let sseBuffer = '';
      let settled = false;
      let hasChunk = false;
      const chunkDecoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8') : null;

      const settleResolve = (payload) => {
        if (settled) {
          return;
        }
        settled = true;
        resolve(payload);
      };

      const settleReject = (payload) => {
        if (settled) {
          return;
        }
        settled = true;
        reject(payload);
      };

      const emitFrame = (frame) => {
        if (typeof onFrame === 'function') {
          onFrame(frame);
        }
        if (frame?.type === 'done') {
          settleResolve(frame.data || frame);
        }
        if (frame?.type === 'error') {
          settleReject(frame.data || frame);
        }
      };

      const parseSseBlock = (block) => {
        if (!block || block.startsWith(':')) {
          return;
        }

        const dataLines = block
          .split('\n')
          .filter(line => line.indexOf('data:') === 0)
          .map(line => line.slice(5).trimStart());

        if (!dataLines.length) {
          return;
        }

        const payload = dataLines.join('\n');
        try {
          emitFrame(JSON.parse(payload));
        } catch (e) {
          emitFrame({ type: 'message', data: payload });
        }
      };

      const parseSseText = (text) => {
        if (!text) {
          return;
        }

        sseBuffer += text.replace(/\r\n/g, '\n');
        let frameEnd = sseBuffer.indexOf('\n\n');
        while (frameEnd >= 0) {
          const block = sseBuffer.slice(0, frameEnd).trim();
          sseBuffer = sseBuffer.slice(frameEnd + 2);
          parseSseBlock(block);
          frameEnd = sseBuffer.indexOf('\n\n');
        }
      };

      const decodeChunk = (buffer) => {
        if (!chunkDecoder) {
          return decodeArrayBuffer(buffer);
        }
        try {
          return chunkDecoder.decode(buffer, { stream: true });
        } catch (e) {
          return decodeArrayBuffer(buffer);
        }
      };

      const flushDecoder = () => {
        if (!chunkDecoder) {
          return '';
        }
        try {
          return chunkDecoder.decode();
        } catch (e) {
          return '';
        }
      };

      const task = wx.request({
        url: `${this.baseUrl}${url}`,
        method,
        data,
        header,
        timeout: 180000,
        enableChunked: true,
        success: (res) => {
          if (res.statusCode === 401 || res.data?.code === 401) {
            this.handleUnauthorized(requestToken);
            settleReject(res.data || { message: '登录已过期' });
            return;
          }

          if (res.statusCode < 200 || res.statusCode >= 300) {
            wx.showToast({ title: res.data?.msg || res.data?.message || 'AI 请求失败', icon: 'none' });
            settleReject(res.data || { message: 'AI 请求失败' });
            return;
          }

          if (!hasChunk && res.data && typeof res.data === 'object' && res.data.code !== 0 && res.data.code !== 200) {
            wx.showToast({ title: res.data.msg || res.data.message || 'AI 请求失败', icon: 'none' });
            settleReject(res.data);
            return;
          }

          if (!hasChunk && typeof res.data === 'string') {
            parseSseText(res.data);
          }
          if (hasChunk) {
            parseSseText(flushDecoder());
          }
          if (sseBuffer.trim()) {
            parseSseBlock(sseBuffer.trim());
            sseBuffer = '';
          }
          settleResolve({ finishReason: 'complete' });
        },
        fail: (err) => {
          if (err?.errMsg && err.errMsg.indexOf('abort') >= 0) {
            settleResolve({ finishReason: 'abort' });
            return;
          }
          wx.showToast({ title: 'AI 连接失败', icon: 'none' });
          settleReject(err);
        }
      });

      stream.requestTask = task;
      if (task && typeof task.onChunkReceived === 'function') {
        task.onChunkReceived((res) => {
          hasChunk = true;
          parseSseText(decodeChunk(res.data));
        });
      }
    });

    return stream;
  }

  handleUnauthorized(requestToken = '') {
    const currentToken = wx.getStorageSync('token');
    if (currentToken && currentToken !== requestToken) {
      return;
    }

    if (this.unauthorizedPrompting) {
      return;
    }
    this.unauthorizedPrompting = true;

    wx.removeStorageSync('token');
    wx.removeStorageSync('refreshToken');
    wx.removeStorageSync('userInfo');
    wx.removeStorageSync('username');
    wx.removeStorageSync('tokenTime');
    let app;
    try {
      app = getApp();
      if (app?.globalData) {
        app.globalData.hasLogin = false;
        app.globalData.userInfo = null;
      }
    } catch (e) {}

    const pages = getCurrentPages();
    if (pages.length > 0) {
      const currentPage = pages[pages.length - 1];
      const route = currentPage.route;

      if (!route.includes('login')) {
        // 防止重复跳转登录页
        if (app && app.globalData && app.globalData.navigatingToLogin) {
          this.unauthorizedPrompting = false;
          return;
        }
        if (app && app.globalData) {
          app.globalData.navigatingToLogin = true;
        }
        wx.showModal({
          title: '提示',
          content: '登录已过期，请重新登录',
          showCancel: false,
          success: () => {
            wx.navigateTo({
              url: '/pages/login/login',
              fail: () => {
                if (app && app.globalData) {
                  app.globalData.navigatingToLogin = false;
                }
              }
            });
          },
          complete: () => {
            setTimeout(() => {
              this.unauthorizedPrompting = false;
            }, 1000);
          }
        });
        return;
      }
    }

    this.unauthorizedPrompting = false;
  }

  resetUnauthorizedState() {
    this.unauthorizedPrompting = false;
  }

  get(url, data, needToken = true) {
    return this.request({ url, method: 'GET', data, needToken });
  }

  post(url, data, needToken = true) {
    return this.request({ url, method: 'POST', data, needToken });
  }

  put(url, data, needToken = true) {
    return this.request({ url, method: 'PUT', data, needToken });
  }

  delete(url, data, needToken = true) {
    return this.request({ url, method: 'DELETE', data, needToken });
  }
}

const request = new Request();

module.exports = {
  request,

  resetUnauthorizedState() {
    request.resetUnauthorizedState();
  },

  streamAiChat(options = {}) {
    const { messages = [], sessionId = '', latitude, longitude, locationAddress, onFrame } = options;
    return request.stream({
      url: '/chat/stream',
      method: 'POST',
      data: { messages, sessionId, latitude, longitude, locationAddress },
      onFrame
    });
  },
  
  loginByWechat(code, userInfo = {}) {
    return request.post('/auth/wechat/login', {
      code,
      nickname: userInfo.nickName || userInfo.nickname || '',
      avatarUrl: userInfo.avatarUrl || ''
    }, false);
  },

  loginByAccount(username, password) {
    return request.post('/auth/login', {
      username,
      password
    }, false);
  },

  register(data) {
    return request.post('/auth/register', data, false);
  },

  getUserInfo() {
    return request.get('/auth/user/info');
  },

  refreshToken() {
    try {
      const refreshToken = wx.getStorageSync('refreshToken');
      return request.post('/auth/refresh', { refreshToken }, false);
    } catch (e) {
      return Promise.reject({ message: '获取refreshToken失败' });
    }
  },

  sendSmsCode(phone, scene = 'register') {
    return request.post('/auth/sms/send', { phone, scene }, false);
  },

  resetPassword(phone, code, newPassword) {
    return request.post('/auth/password/reset', { phone, code, newPassword }, false);
  },

  sendVerifyCode(phone) {
    return request.post('/auth/sms/send', { phone, scene: 'register' }, false);
  },

  verifyCode(phone, code) {
    return Promise.resolve({ code: 200, data: { phone, code } });
  },

  getParkingMapPoints() {
    return request.get('/parking/maps/points');
  },

  getParkingMapPointDetail(id) {
    return request.get(`/parking/maps/points/${id}`);
  },

  getParkingSharedAreas() {
    return request.get('/parking/shared-areas');
  },

  getParkingProducts(params = {}) {
    return request.get('/parking/products', params);
  },

  getParkingProductDetail(id) {
    return request.get(`/parking/products/${id}`);
  },

  selectParkingProductLots(id, parkingLotIds) {
    return request.post(`/parking/products/${id}/select-lots`, { parkingLotIds });
  },

  getCurrentParkingPasses() {
    return request.get('/parking/passes/current');
  },

  getShareApplications(params = {}) {
    return request.get('/parking/share-applications', params);
  },

  createShareApplication(data) {
    return request.post('/parking/share-applications', data);
  },

  getNotices(params = {}) {
    return request.get('/notices', params);
  },

  getNoticeUnreadCount() {
    return request.get('/notices/unread-count');
  },

  getNoticeDetail(id) {
    return request.get(`/notices/${id}`);
  },

  markNoticeRead(id) {
    return request.post(`/notices/${id}/read`);
  },

  readAllNotices(params = {}) {
    return request.post('/notices/read-all', params);
  },

  deleteNotice(id) {
    return request.delete(`/notices/${id}`);
  },

  clearNotices(params = {}) {
    return request.delete('/notices', params);
  }
};
