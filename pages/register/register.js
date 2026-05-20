const app = getApp();
const api = require('../../utils/api.js');

Page({
  data: {
    phone: '',
    code: '',
    password: '',
    confirmPassword: '',
    agreed: false,
    codeText: '获取验证码',
    codeDisabled: false,
    countdown: 60
  },

  onPhoneInput(e) {
    this.setData({ phone: e.detail.value });
  },

  onCodeInput(e) {
    this.setData({ code: e.detail.value });
  },

  onPasswordInput(e) {
    this.setData({ password: e.detail.value });
  },

  onConfirmPasswordInput(e) {
    this.setData({ confirmPassword: e.detail.value });
  },

  onAgreementChange(e) {
    this.setData({ agreed: e.detail.value.includes('agree') });
  },

  async getCode() {
    const { phone } = this.data;
    
    if (!phone || phone.length !== 11) {
      wx.showToast({ title: '请输入正确的手机号', icon: 'none' });
      return;
    }

    try {
      wx.showLoading({ title: '发送中...' });
      await api.sendSmsCode(phone, 'register');
      wx.hideLoading();
      wx.showToast({ title: '验证码已发送', icon: 'success' });
      
      this.setData({ codeDisabled: true });
      let countdown = 60;
      const timer = setInterval(() => {
        countdown--;
        if (countdown <= 0) {
          clearInterval(timer);
          this.setData({ codeText: '获取验证码', codeDisabled: false, countdown: 60 });
        } else {
          this.setData({ codeText: `${countdown}s后重试` });
        }
      }, 1000);
    } catch (err) {
      wx.hideLoading();
      console.error('发送验证码失败:', err);
    }
  },

  async handleRegister() {
    const { phone, code, password, confirmPassword, agreed } = this.data;
    
    if (!phone || phone.length !== 11) {
      wx.showToast({ title: '请输入正确的手机号', icon: 'none' });
      return;
    }
    
    if (!code || code.length !== 6) {
      wx.showToast({ title: '请输入6位验证码', icon: 'none' });
      return;
    }
    
    if (!password || password.length < 6 || password.length > 20) {
      wx.showToast({ title: '密码需6-20位', icon: 'none' });
      return;
    }
    
    if (password !== confirmPassword) {
      wx.showToast({ title: '两次密码不一致', icon: 'none' });
      return;
    }
    
    if (!agreed) {
      wx.showToast({ title: '请同意用户协议', icon: 'none' });
      return;
    }

    try {
      wx.showLoading({ title: '注册中...' });
      const res = await api.register({ phone, code, password });
      wx.hideLoading();

      const token = res?.data?.token;
      if (token) {
        const userInfo = this.normalizeUserInfo(res.data.userInfo || {});
        wx.setStorageSync('token', token);
        wx.setStorageSync('refreshToken', res.data.refreshToken || token);
        wx.setStorageSync('tokenTime', Date.now());
        wx.setStorageSync('userInfo', userInfo);
        api.resetUnauthorizedState();
        app.globalData.hasLogin = true;
        app.globalData.userInfo = userInfo;
      }
      
      wx.showToast({ title: '注册成功', icon: 'success' });
      
      setTimeout(() => {
        wx.switchTab({ url: '/pages/index/index' });
      }, 1500);
    } catch (err) {
      wx.hideLoading();
      console.error('注册失败:', err);
    }
  },

  normalizeUserInfo(userInfo) {
    return {
      ...userInfo,
      nickName: userInfo.nickName || userInfo.nickname || userInfo.username || userInfo.phone || '停车用户',
      avatarUrl: userInfo.avatarUrl || userInfo.avatar || ''
    };
  },

  showAgreement() {
    wx.showModal({
      title: '用户服务协议',
      content: '这里是用户服务协议的内容...',
      showCancel: false
    });
  },

  showPrivacy() {
    wx.showModal({
      title: '隐私政策',
      content: '这里是隐私政策的内容...',
      showCancel: false
    });
  },

  goBack() {
    wx.navigateBack();
  },

  goLogin() {
    wx.navigateBack();
  }
});
