const api = require('../../utils/api.js');

const PRODUCT_TYPES = [
  { label: '全部', value: '' },
  { label: '月租', value: 1 },
  { label: '预约', value: 3 },
  { label: '错峰', value: 4 }
];

Page({
  data: {
    tabs: PRODUCT_TYPES,
    activeType: '',
    products: [],
    loading: false,
    showEmpty: false,
    passCount: 0,
    parkingLotId: '',
    parkingName: ''
  },

  onLoad(options = {}) {
    this.setData({
      parkingLotId: options.parkingLotId ? String(options.parkingLotId) : '',
      parkingName: options.parkingName ? decodeURIComponent(options.parkingName) : ''
    });
    this.loadProducts();
  },

  onShow() {
    this.loadProducts();
  },

  async loadProducts() {
    if (this.data.loading) return;
    this.setData({ loading: true });

    try {
      const params = {
        pageNum: 1,
        pageSize: 50
      };
      if (this.data.activeType) {
        params.productType = this.data.activeType;
      }
      if (this.data.parkingLotId) {
        params.parkingLotId = this.data.parkingLotId;
      }

      const [productRes, passRes] = await Promise.all([
        api.getParkingProducts(params),
        api.getCurrentParkingPasses()
      ]);
      const records = productRes?.data?.records || [];
      const passes = passRes?.data || [];

      this.setData({
        products: records.map(item => this.normalizeProduct(item)),
        passCount: passes.length,
        showEmpty: records.length === 0
      });
    } catch (err) {
      console.error('加载停车套餐失败:', err);
      this.setData({ products: [], showEmpty: true });
      wx.showToast({ title: '套餐加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  normalizeProduct(item) {
    const parkingLots = item.parkingLots || [];
    const lotNames = parkingLots.slice(0, 2).map(lot => lot.name).filter(Boolean);
    const quota = item.quotaRule || {};
    const tags = [
      item.productTypeName || '停车套餐',
      item.durationDays ? `${item.durationDays}天` : '',
      quota.reservationRequired === 1 ? '需预约' : ''
    ].filter(Boolean);

    return {
      id: String(item.id),
      description: item.description || '覆盖指定停车场',
      displayPriceText: item.displayPriceText || '价格待定',
      lotNames: lotNames.join('、'),
      owned: item.owned === true,
      parkingLotCount: item.parkingLotCount || parkingLots.length,
      productName: item.productName || '停车套餐',
      productType: item.productType,
      productTypeName: item.productTypeName || '停车套餐',
      tags
    };
  },

  onTabTap(e) {
    const value = e.currentTarget.dataset.value;
    this.setData({ activeType: value === undefined ? '' : value }, () => {
      this.loadProducts();
    });
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id;
    const parkingLotId = this.data.parkingLotId ? `&parkingLotId=${this.data.parkingLotId}` : '';
    wx.navigateTo({ url: `/pages/package/detail?id=${id}${parkingLotId}` });
  }
});
