const api = require('../../utils/api.js');

const DEFAULT_VEHICLES = [
  { id: 'default-1', plateNumber: '沪A·123F5' },
  { id: 'default-2', plateNumber: '沪B·678DF' }
];

Page({
  data: {
    address: '延长路99弄维宸苑9号301室',
    avatarUrl: '/images/avatar-default.png',
    displayName: '点击登录',
    hasUserInfo: false,
    invoices: [
      { amount: '120.00', id: 'invoice-1', title: '2025年7月停车费发票' },
      { amount: '180.50', id: 'invoice-2', title: '2025年8月停车费发票' }
    ],
    phoneMasked: '未绑定',
    shareApplications: [],
    shareApplicationsLoaded: false,
    userInfo: null,
    userLevel: '登录后享受更多服务',
    vehicles: DEFAULT_VEHICLES
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

  loadVehicles() {
    const storedVehicles = wx.getStorageSync('vehicles');
    this.setData({
      vehicles: Array.isArray(storedVehicles) && storedVehicles.length > 0 ? storedVehicles : DEFAULT_VEHICLES
    });
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
    const id = String(e.currentTarget.dataset.id);
    const vehicles = this.data.vehicles.filter(item => item.id !== id);
    this.setData({ vehicles });
    wx.setStorageSync('vehicles', vehicles);
  },

  goToShareApply() {
    wx.navigateTo({ url: '/pages/shareApply/shareApply' });
  },

  applyInvoice() {
    wx.showToast({ title: '开票申请已记录', icon: 'success' });
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
