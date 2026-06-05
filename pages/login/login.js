const app = getApp();
const api = require('../../utils/api.js');

Page({
  data: {
    username: '',
    password: '',
    agreeProtocol: false,
    loading: false
  },

  onLoad(options) {
    app.globalData.navigatingToLogin = false;
    api.resetUnauthorizedState();
    const token = wx.getStorageSync('token');
    if (token) {
      this.checkLoginStatus();
    }
  },

  async checkLoginStatus() {
    try {
      const res = await api.getUserInfo();
      if (res.data) {
        wx.setStorageSync('userInfo', this.normalizeUserInfo(res.data));
        wx.switchTab({ url: '/pages/index/index' });
      }
    } catch (err) {
      wx.removeStorageSync('token');
    }
  },

  onUsernameInput(e) {
    this.setData({ username: e.detail.value });
  },

  onPasswordInput(e) {
    this.setData({ password: e.detail.value });
  },

  onAgreeChange(e) {
    this.setData({ agreeProtocol: e.detail.value.length > 0 });
  },

  async handleWechatLogin() {
    if (!this.data.agreeProtocol) {
      wx.showToast({ title: '请先阅读并同意用户服务协议', icon: 'none' });
      return;
    }

    if (this.data.loading) return;
    this.setData({ loading: true });

    try {
      wx.showLoading({ title: '登录中...' });

      const profileRes = await this.getWechatProfile();
      const loginRes = await this.wxLogin();
      const res = await api.loginByWechat(loginRes.code, profileRes.userInfo);

      this.handleLoginSuccess(res);
    } catch (err) {
      console.error('微信登录失败:', err);
      if (err.errMsg && err.errMsg.includes('deny')) {
        wx.showToast({ title: '您拒绝了授权', icon: 'none' });
      } else {
        wx.showToast({ title: err.msg || err.message || '登录失败，请重试', icon: 'none' });
      }
    } finally {
      this.setData({ loading: false });
      wx.hideLoading();
    }
  },

  getWechatProfile() {
    return new Promise((resolve, reject) => {
      wx.getUserProfile({
        desc: '用于微信账号登录',
        success: resolve,
        fail: reject
      });
    });
  },

  wxLogin() {
    return new Promise((resolve, reject) => {
      wx.login({
        success: resolve,
        fail: reject
      });
    });
  },

  async handleAccountLogin() {
    const { username, password, agreeProtocol } = this.data;

    if (!agreeProtocol) {
      wx.showToast({ title: '请先阅读并同意用户服务协议', icon: 'none' });
      return;
    }

    if (!username.trim()) {
      wx.showToast({ title: '请输入账号', icon: 'none' });
      return;
    }
    if (!password.trim()) {
      wx.showToast({ title: '请输入密码', icon: 'none' });
      return;
    }

    if (this.data.loading) return;
    this.setData({ loading: true });

    try {
      wx.showLoading({ title: '登录中...' });

      const res = await api.loginByAccount(username.trim(), password);

      this.handleLoginSuccess(res);
    } catch (err) {
      console.error('账号登录失败:', err);
    } finally {
      this.setData({ loading: false });
      wx.hideLoading();
    }
  },

  handleLoginSuccess(res) {
    const token = res?.data?.token;
    const refreshToken = res?.data?.refreshToken || token;
    const userInfo = this.normalizeUserInfo(res?.data?.userInfo || {});

    if (!token) {
      wx.showToast({ title: '登录响应缺少token', icon: 'none' });
      return;
    }

    wx.setStorageSync('token', token);
    wx.setStorageSync('tokenTime', Date.now());
    wx.setStorageSync('refreshToken', refreshToken);
    wx.setStorageSync('userInfo', userInfo);

    wx.removeStorageSync('notices');
    api.resetUnauthorizedState();

    app.globalData.hasLogin = true;
    app.globalData.userInfo = userInfo;

    wx.showToast({ title: '登录成功', icon: 'success' });
    wx.switchTab({ url: '/pages/index/index' });
  },

  normalizeUserInfo(userInfo) {
    return {
      ...userInfo,
      nickName: userInfo.nickName || userInfo.nickname || userInfo.username || userInfo.phone || '停车用户',
      avatarUrl: userInfo.avatarUrl || userInfo.avatar || ''
    };
  },

  onForgetPwd() {
    wx.showModal({
      title: '忘记密码',
      content: '请选择找回方式',
      confirmText: '手机验证',
      cancelText: '联系客服',
      success: (res) => {
        if (res.confirm) {
          this.goResetPassword();
        } else if (res.cancel) {
          wx.showToast({ 
            title: '请联系客服：400-xxx-xxxx', 
            icon: 'none',
            duration: 3000
          });
        }
      }
    });
  },

  goResetPassword() {
    wx.navigateTo({ url: '/pages/forgetPassword/forgetPassword' });
  },

  goRegister() {
    wx.navigateTo({ url: '/pages/register/register' });
  },

  goProtocol() {
    wx.showModal({
      title: '用户协议与隐私政策',
      content: '请遵守停车联盟服务规则。我们仅收集登录、停车预约和车辆服务所需信息。',
      showCancel: false
    });
  }
});
