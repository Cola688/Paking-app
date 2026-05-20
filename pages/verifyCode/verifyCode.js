Page({
  data: {
    phone: '',
    codeArr: ['', '', '', ''],
    codeFocus: [true, false, false, false],
    countdown: 60
  },

  onLoad(options) {
    if (options.phone) {
      this.setData({ phone: options.phone });
    }
    this.startCountdown();
  },

  onCodeInput(e) {
    const value = e.detail.value;
    const index = parseInt(e.currentTarget.dataset.index);
    
    let { codeArr, codeFocus } = this.data;
    codeArr[index] = value;
    
    if (value && index < 3) {
      codeFocus[index + 1] = true;
    }
    
    this.setData({ codeArr, codeFocus });
    
    // 检查是否输入完成
    if (codeArr.join('').length === 4) {
      this.verifyCode(codeArr.join(''));
    }
  },

  startCountdown() {
    let countdown = 60;
    const timer = setInterval(() => {
      countdown--;
      if (countdown <= 0) {
        clearInterval(timer);
        this.setData({ countdown: 0 });
      } else {
        this.setData({ countdown });
      }
    }, 1000);
  },

  getCode() {
    wx.showToast({ title: '验证码已发送', icon: 'success' });
    this.setData({ countdown: 60 });
    this.startCountdown();
  },

  verifyCode(code) {
    wx.showToast({ title: '验证成功', icon: 'success' });
    setTimeout(() => {
      wx.navigateBack();
    }, 1000);
  },

  goBack() {
    wx.navigateBack();
  }
});
