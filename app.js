const api = require('./utils/api.js');

const getBaseUrl = () => {
  try {
    const platform = wx.getSystemInfoSync().platform;
    return platform === 'devtools'
      ? 'http://localhost:7003/app/api/v1'
      : 'http://192.168.124.8:7003/app/api/v1';
  } catch (e) {
    return 'http://localhost:7003/app/api/v1';
  }
};

App({
  globalData: {
    userInfo: null,
    hasLogin: false,
    baseUrl: getBaseUrl(),
    amapWebServiceKey: '45a5bfb8904470a857b24f23c0a82b58',
    currentLocation: null
  },

  onLaunch() {
    wx.removeStorageSync('notices');
    this.checkLoginStatus();
    this.autoRefreshToken();
  },

  onShow() {
    this.autoRefreshToken();
  },

  checkLoginStatus() {
    const token = wx.getStorageSync('token');
    if (token) {
      this.globalData.hasLogin = true;
      const userInfo = wx.getStorageSync('userInfo');
      if (userInfo) {
        this.globalData.userInfo = userInfo;
      }
    } else {
      this.globalData.hasLogin = false;
    }
  },

  autoRefreshToken() {
    const token = wx.getStorageSync('token');
    const refreshToken = wx.getStorageSync('refreshToken');
    
    if (token && refreshToken) {
      const tokenTime = wx.getStorageSync('tokenTime') || 0;
      const now = Date.now();
      
      if (now - tokenTime > 2 * 60 * 60 * 1000) {
        api.refreshToken().then(res => {
          wx.setStorageSync('token', res.data.token);
          wx.setStorageSync('refreshToken', res.data.refreshToken);
          wx.setStorageSync('tokenTime', Date.now());
        }).catch(() => {
          this.clearLoginData();
        });
      }
    }
  },

  clearLoginData() {
    wx.removeStorageSync('token');
    wx.removeStorageSync('refreshToken');
    wx.removeStorageSync('userInfo');
    wx.removeStorageSync('username');
    wx.removeStorageSync('tokenTime');
    this.globalData.hasLogin = false;
    this.globalData.userInfo = null;
  }
});
