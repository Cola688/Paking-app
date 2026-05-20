const api = require('../../utils/api.js');

Page({
  data: {
    phone: '',
    code: '',
    password: '',
    confirmPassword: '',
    codeText: '获取验证码',
    codeDisabled: false
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

  async getCode() {
    const { phone } = this.data;
    
    if (!phone || phone.length !== 11) {
      wx.showToast({ title: '请输入正确的手机号', icon: 'none' });
      return;
    }

    try {
      wx.showLoading({ title: '发送中...' });
      await api.sendSmsCode(phone, 'reset');
      wx.hideLoading();
      wx.showToast({ title: '验证码已发送', icon: 'success' });
      
      this.setData({ codeDisabled: true });
      let countdown = 60;
      const timer = setInterval(() => {
        countdown--;
        if (countdown <= 0) {
          clearInterval(timer);
          this.setData({ codeText: '获取验证码', codeDisabled: false });
        } else {
          this.setData({ codeText: `${countdown}s后重试` });
        }
      }, 1000);
    } catch (err) {
      wx.hideLoading();
      console.error('发送验证码失败:', err);
    }
  },

  async handleSubmit() {
    const { phone, code, password, confirmPassword } = this.data;
    
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

    try {
      wx.showLoading({ title: '修改中...' });
      await api.resetPassword(phone, code, password);
      wx.hideLoading();
      wx.showToast({ title: '密码修改成功', icon: 'success' });
      
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    } catch (err) {
      wx.hideLoading();
      console.error('修改密码失败:', err);
    }
  },

  goBack() {
    wx.navigateBack();
  },

  goLogin() {
    wx.navigateBack();
  }
});
