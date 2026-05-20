const DEVTOOLS_BASE_URL = 'http://localhost:7003/app/api/v1';
const DEVICE_BASE_URL = 'http://192.168.124.8:7003/app/api/v1';

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
    try {
      const app = getApp();
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
        wx.showModal({
          title: '提示',
          content: '登录已过期，请重新登录',
          showCancel: false,
          success: () => {
            wx.navigateTo({ url: '/pages/login/login' });
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

  getParkingLots() {
    return request.get('/parking/lots');
  },

  getParkingLotsByLocation(lat, lng, radius) {
    return request.get('/parking/lots/nearby', { lat, lng, radius });
  },

  getParkingDetail(id) {
    return request.get(`/parking/lots/${id}`);
  },

  getParkingMapPoints() {
    return request.get('/parking/maps/points');
  },

  getParkingMapPointDetail(id) {
    return request.get(`/parking/maps/points/${id}`);
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
