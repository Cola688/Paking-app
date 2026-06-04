const api = require('../../utils/api.js');

Page({
  data: {
    address: '',
    avatarUrl: '/images/avatar-default.png',
    displayName: '点击登录',
    hasUserInfo: false,
    phoneMasked: '未绑定',
    shareApplications: [],
    shareApplicationsLoaded: false,
    userInfo: null,
    userLevel: '登录后享受更多服务',
    vehicles: [],
    vehiclesLoaded: false
  },

  onLoad(options) {
    if (options.tab === 'record') {
      this.goToRecord();
    }
    this.refreshPageData();
  },

  onShow() {
    this.refreshPageData();
  },

  refreshPageData() {
    this.checkLogin();
    this.loadVehicles();
    this.loadShareApplications();
    this.loadUserProfile();
  },

  async loadUserProfile() {
    const token = wx.getStorageSync('token');
    if (!token) return;

    try {
      const res = await api.getUserInfo();
      const info = res?.data || {};
      const rawPhone = info.phone || '';
      this.setData({
        address: info.contactAddress || '',
        phoneMasked: this.maskPhone(rawPhone)
      });
    } catch (err) {
      console.error('加载用户资料失败:', err);
    }
  },

  checkLogin() {
    const userInfo = wx.getStorageSync('userInfo');
    const username = wx.getStorageSync('username') || '';
    const token = wx.getStorageSync('token');
    const hasUserInfo = Boolean(userInfo || token);
    const displayName = userInfo?.nickName || userInfo?.nickname || username || (token ? '车主用户' : '点击登录');

    this.setData({
      avatarUrl: userInfo?.avatarUrl || '/images/avatar-default.png',
      displayName,
      hasUserInfo,
      phoneMasked: this.maskPhone(username),
      userInfo: userInfo || null,
      userLevel: hasUserInfo ? '注册用户' : '登录后享受更多服务'
    });
  },

  async loadVehicles() {
    const token = wx.getStorageSync('token');
    if (!token) {
      this.setData({ vehicles: [], vehiclesLoaded: true });
      return;
    }

    try {
      const res = await api.getUserPlates({ pageNum: 1, pageSize: 10 });
      const records = res?.data?.records || res?.records || [];
      const vehicles = records.map(item => ({
        id: item.id,
        plateNumber: item.plateNumber,
        plateColor: item.plateColor,
        isDefault: item.isDefault
      }));
      this.setData({ vehicles, vehiclesLoaded: true });
    } catch (err) {
      console.error('加载车辆失败:', err);
      this.setData({ vehicles: [], vehiclesLoaded: true });
    }
  },

  async loadShareApplications() {
    const token = wx.getStorageSync('token');
    if (!token) {
      this.setData({
        shareApplications: [],
        shareApplicationsLoaded: true
      });
      return;
    }

    try {
      const res = await api.getShareApplications({ pageNum: 1, pageSize: 20 });
      const records = res?.data?.records || [];
      this.setData({
        shareApplications: records.map(item => this.normalizeShareApplication(item)),
        shareApplicationsLoaded: true
      });
    } catch (err) {
      console.error('加载共享申请失败:', err);
      this.setData({
        shareApplications: [],
        shareApplicationsLoaded: true
      });
    }
  },

  normalizeShareApplication(item = {}) {
    const statusMeta = this.getShareStatusMeta(item.auditStatus);
    return {
      areaName: item.parkingAreaName || item.locationWeight || '已提交申请区域',
      date: this.formatDate(item.createdAt || item.updatedAt),
      id: String(item.id || item.applicationNo || Date.now()),
      status: statusMeta.status,
      statusText: statusMeta.text,
      title: item.applicationNo ? `共享车位申请 ${item.applicationNo}` : '共享车位申请'
    };
  },

  getShareStatusMeta(auditStatus) {
    const rawValue = auditStatus && typeof auditStatus === 'object'
      ? (auditStatus.value ?? auditStatus.name ?? auditStatus.label)
      : auditStatus;
    const value = String(rawValue ?? '').toUpperCase();

    if (rawValue === 1 || value === '1' || value === 'APPROVED' || value.includes('通过')) {
      return { status: 'approved', text: '已通过' };
    }
    if (rawValue === 2 || value === '2' || value === 'REJECTED' || value.includes('拒') || value.includes('驳')) {
      return { status: 'rejected', text: '已驳回' };
    }
    return { status: 'pending', text: '审核中' };
  },

  formatDate(value) {
    if (!value) {
      return '';
    }
    return String(value).slice(0, 10);
  },

  maskPhone(phone) {
    const value = String(phone || '').trim();
    if (!/^1\d{10}$/.test(value)) {
      return value || '未绑定';
    }
    return `${value.slice(0, 3)}****${value.slice(7)}`;
  },

  getUserInfo() {
    if (this.data.hasUserInfo) return;
    wx.getUserProfile({
      desc: '用于完善用户资料',
      success: (res) => {
        this.setData({ hasUserInfo: true, userInfo: res.userInfo });
        wx.setStorageSync('userInfo', res.userInfo);
        this.checkLogin();
      }
    });
  },

  login() {
    if (this.data.hasUserInfo) return;
    this.getUserInfo();
  },

  deleteVehicle(e) {
    const id = e.currentTarget.dataset.id;
    const vehicle = this.data.vehicles.find(v => v.id == id);
    if (!vehicle) return;

    wx.showModal({
      title: '确认解绑',
      content: `确定要解绑车辆 ${vehicle.plateNumber} 吗？`,
      confirmColor: '#d33b3b',
      success: async (res) => {
        if (!res.confirm) return;

        try {
          await api.unbindUserPlate(id);
          wx.showToast({ title: '解绑成功', icon: 'success' });
          this.loadVehicles();
        } catch (err) {
          console.error('解绑失败:', err);
          wx.showToast({ title: err?.data?.msg || err?.data?.message || '解绑失败', icon: 'none' });
        }
      }
    });
  },

  goToShareApply() {
    wx.navigateTo({ url: '/pages/shareApply/shareApply' });
  },

  goToInfoEdit() {
    const token = wx.getStorageSync('token');
    if (!token) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: '/pages/mine/infoEdit/infoEdit' });
  },

  goToRecord() {
    wx.navigateTo({ url: '/pages/record/record' });
  },

  goToCoupon() {
    wx.navigateTo({ url: '/pages/coupon/coupon' });
  },

  goToFavorite() {
    wx.navigateTo({ url: '/pages/favorite/favorite' });
  },

  goToCar() {
    wx.navigateTo({ url: '/pages/car/car' });
  },

  goToHelp() {
    wx.navigateTo({ url: '/pages/help/help' });
  },

  goToAbout() {
    wx.navigateTo({ url: '/pages/about/about' });
  },

  callService() {
    wx.showModal({
      title: '联系客服',
      content: '客服电话：400-xxx-xxxx',
      showCancel: false
    });
  }
});
