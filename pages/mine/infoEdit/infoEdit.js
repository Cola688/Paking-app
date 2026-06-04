const api = require('../../../utils/api.js');

Page({
  data: {
    form: {
      avatarUrl: '',
      contactAddress: '',
      nickname: '',
      phone: '',
      realName: ''
    },
    originalForm: {},
    saving: false,

    // 绑定手机号
    showBindPhone: false,
    bindForm: {
      phone: '',
      code: ''
    },
    binding: false,
    smsCountdown: 0,
    smsTimer: null
  },

  onLoad() {
    this.loadUserInfo();
  },

  onUnload() {
    this.stopCountdown();
  },

  async loadUserInfo() {
    try {
      const res = await api.getUserInfo();
      const info = res?.data || {};
      const rawPhone = info.phone || '';
      const form = {
        avatarUrl: info.avatarUrl || '',
        contactAddress: info.contactAddress || '',
        nickname: info.nickname || '',
        phone: this.maskPhone(rawPhone),
        rawPhone,
        realName: info.realName || ''
      };
      this.setData({ form, originalForm: { ...form } });
    } catch (err) {
      console.error('加载用户信息失败:', err);
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  isBoundPhone() {
    const rawPhone = this.data.form.rawPhone || '';
    return /^1\d{10}$/.test(rawPhone.trim());
  },

  maskPhone(phone) {
    const value = String(phone || '').trim();
    if (!/^1\d{10}$/.test(value)) {
      return '';
    }
    return `${value.slice(0, 3)}****${value.slice(7)}`;
  },

  onInputField(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    this.setData({
      ['form.' + field]: value
    });
  },

  onChangeAvatar() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        this.uploadAvatar(tempFilePath);
      }
    });
  },

  uploadAvatar(filePath) {
    wx.showLoading({ title: '上传中...', mask: true });
    wx.uploadFile({
      url: (getApp()?.globalData?.baseUrl || '') + '/oss/files',
      filePath,
      name: 'file',
      header: {
        Authorization: wx.getStorageSync('token') || ''
      },
      success: (res) => {
        wx.hideLoading();
        try {
          const data = JSON.parse(res.data);
          const url = data?.data?.url || data?.data?.directUrl || '';
          if (url) {
            this.setData({ ['form.avatarUrl']: url });
            wx.showToast({ title: '头像更新成功', icon: 'success' });
          } else {
            wx.showToast({ title: '上传失败，请重试', icon: 'none' });
          }
        } catch (e) {
          wx.showToast({ title: '上传失败', icon: 'none' });
        }
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: '上传失败', icon: 'none' });
      }
    });
  },

  // ========== 手机号绑定 ==========

  noop() {},

  onTapPhone() {
    this.setData({
      showBindPhone: true,
      bindForm: { phone: '', code: '' }
    });
  },

  onCancelBind() {
    this.setData({ showBindPhone: false });
    this.stopCountdown();
  },

  onBindField(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    this.setData({
      ['bindForm.' + field]: value
    });
  },

  onSendSms() {
    if (this.data.smsCountdown > 0) return;

    const phone = this.data.bindForm.phone.trim();
    if (!/^1\d{10}$/.test(phone)) {
      wx.showToast({ title: '请输入正确的手机号', icon: 'none' });
      return;
    }

    this.setData({ smsCountdown: 60 });

    api.sendSmsCode(phone, 'bind')
      .then(() => {
        wx.showToast({ title: '验证码已发送', icon: 'success' });
      })
      .catch(() => {
        this.setData({ smsCountdown: 0 });
      });

    this.smsTimer = setInterval(() => {
      const countdown = this.data.smsCountdown - 1;
      if (countdown <= 0) {
        this.stopCountdown();
      } else {
        this.setData({ smsCountdown: countdown });
      }
    }, 1000);
  },

  stopCountdown() {
    if (this.smsTimer) {
      clearInterval(this.smsTimer);
      this.smsTimer = null;
    }
    this.setData({ smsCountdown: 0 });
  },

  async onConfirmBind() {
    if (this.data.binding) return;

    const { phone, code } = this.data.bindForm;
    if (!/^1\d{10}$/.test(phone.trim())) {
      wx.showToast({ title: '请输入正确的手机号', icon: 'none' });
      return;
    }
    if (!code.trim()) {
      wx.showToast({ title: '请输入验证码', icon: 'none' });
      return;
    }

    this.setData({ binding: true });

    try {
      const res = await api.bindPhone(phone.trim(), code.trim());
      const info = res?.data || {};
      const rawPhone = info.phone || '';
      const form = {
        avatarUrl: info.avatarUrl || this.data.form.avatarUrl,
        contactAddress: info.contactAddress || this.data.form.contactAddress,
        nickname: info.nickname || this.data.form.nickname,
        phone: this.maskPhone(rawPhone),
        rawPhone,
        realName: info.realName || this.data.form.realName
      };

      // 同步本地缓存
      const userInfo = wx.getStorageSync('userInfo') || {};
      userInfo.phoneNumber = rawPhone;
      wx.setStorageSync('userInfo', userInfo);

      this.setData({
        form,
        originalForm: { ...form },
        showBindPhone: false,
        bindForm: { phone: '', code: '' }
      });
      this.stopCountdown();
      wx.showToast({ title: '手机号绑定成功', icon: 'success' });
    } catch (err) {
      console.error('绑定手机号失败:', err);
    } finally {
      this.setData({ binding: false });
    }
  },

  // ========== 保存 ==========

  async onSave() {
    if (this.data.saving) return;

    const { form, originalForm } = this.data;
    const payload = {};

    if (form.nickname !== originalForm.nickname) {
      payload.nickname = form.nickname.trim();
    }
    if (form.realName !== originalForm.realName) {
      payload.realName = form.realName.trim();
    }
    if (form.contactAddress !== originalForm.contactAddress) {
      payload.contactAddress = form.contactAddress.trim();
    }
    if (form.avatarUrl !== originalForm.avatarUrl) {
      payload.avatarUrl = form.avatarUrl;
    }

    if (!Object.keys(payload).length) {
      wx.showToast({ title: '未做任何修改', icon: 'none' });
      return;
    }

    this.setData({ saving: true });

    try {
      const res = await api.updateUserInfo(payload);
      const info = res?.data || {};
      const rawPhone = info.phone || form.rawPhone || '';
      const newForm = {
        avatarUrl: info.avatarUrl || form.avatarUrl,
        contactAddress: info.contactAddress || form.contactAddress,
        nickname: info.nickname || form.nickname,
        phone: this.maskPhone(rawPhone),
        rawPhone,
        realName: info.realName || form.realName
      };

      // 同步本地缓存
      const userInfo = wx.getStorageSync('userInfo') || {};
      if (newForm.nickname) userInfo.nickName = newForm.nickname;
      if (newForm.avatarUrl) userInfo.avatarUrl = newForm.avatarUrl;
      wx.setStorageSync('userInfo', userInfo);

      this.setData({ form: newForm, originalForm: { ...newForm } });
      wx.showToast({ title: '保存成功', icon: 'success' });
    } catch (err) {
      console.error('保存用户信息失败:', err);
      wx.showToast({ title: '保存失败，请重试', icon: 'none' });
    } finally {
      this.setData({ saving: false });
    }
  }
});
