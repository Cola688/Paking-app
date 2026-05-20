const app = getApp();
const api = require('../../utils/api.js');

Page({
  data: {
    id: '',
    product: null,
    parkingLots: [],
    preselectLotId: '',
    selectedLotIds: [],
    maxSelectLotCount: 1,
    loading: false,
    submitting: false
  },

  onLoad(options = {}) {
    if (!options.id) {
      wx.navigateBack();
      return;
    }
    this.setData({
      id: options.id,
      preselectLotId: options.parkingLotId ? String(options.parkingLotId) : ''
    });
    this.loadDetail(options.id);
  },

  async loadDetail(id) {
    this.setData({ loading: true });
    try {
      const res = await api.getParkingProductDetail(id);
      const product = this.normalizeProduct(res?.data || {}, this.data.preselectLotId);
      this.setData({
        product,
        parkingLots: product.parkingLots,
        selectedLotIds: product.selectedParkingLotIds,
        maxSelectLotCount: product.maxSelectLotCount
      });
    } catch (err) {
      console.error('加载套餐详情失败:', err);
      wx.showToast({ title: '套餐不可用', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  normalizeProduct(item, preselectLotId = '') {
    const quota = item.quotaRule || {};
    const maxSelectLotCount = Number(quota.maxSelectLotCount || 1);
    let selected = (item.selectedParkingLotIds || []).map(id => String(id));
    const lotIds = (item.parkingLots || []).map(lot => String(lot.id));
    if (selected.length === 0 && preselectLotId && lotIds.includes(String(preselectLotId))) {
      selected = [String(preselectLotId)];
    }
    const lots = (item.parkingLots || []).map(lot => ({
      id: String(lot.id),
      checked: selected.includes(String(lot.id)),
      location: lot.location || '暂无地址',
      name: lot.name || '停车场',
      priceText: lot.monthlyPrice ? `¥${lot.monthlyPrice}/月` : (lot.price ? `¥${lot.price}/${lot.priceUnit || '小时'}` : '价格待定'),
      totalSpots: lot.totalSpots || 0
    }));

    return {
      id: String(item.id),
      description: item.description || '',
      displayPriceText: item.displayPriceText || '价格待定',
      durationDays: item.durationDays || 0,
      maxBindVehicleCount: quota.maxBindVehicleCount || 1,
      maxSelectLotCount,
      owned: item.owned === true,
      parkingLots: lots,
      productName: item.productName || '停车套餐',
      productTypeName: item.productTypeName || '停车套餐',
      reservationRequired: quota.reservationRequired === 1,
      selectedParkingLotIds: selected
    };
  },

  toggleLot(e) {
    const id = String(e.currentTarget.dataset.id);
    const selected = [...this.data.selectedLotIds];
    const existingIndex = selected.indexOf(id);
    if (existingIndex >= 0) {
      selected.splice(existingIndex, 1);
    } else {
      if (selected.length >= this.data.maxSelectLotCount) {
        wx.showToast({ title: `最多选择${this.data.maxSelectLotCount}个停车场`, icon: 'none' });
        return;
      }
      selected.push(id);
    }

    this.setData({
      selectedLotIds: selected,
      parkingLots: this.data.parkingLots.map(item => ({
        ...item,
        checked: selected.includes(item.id)
      }))
    });
  },

  async confirmPackage() {
    if (this.data.selectedLotIds.length === 0) {
      wx.showToast({ title: '请选择停车场', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });
    try {
      const res = await api.selectParkingProductLots(this.data.id, this.data.selectedLotIds);
      const product = res?.data || this.data.product;
      const selectedLotIds = this.data.selectedLotIds.map(id => String(id));
      const currentPackage = {
        id: String(product.id || this.data.id),
        parkingLotIds: selectedLotIds,
        productName: product.productName || this.data.product.productName
      };

      app.globalData.selectedPackageId = currentPackage.id;
      app.globalData.selectedPackageParkingLotIds = selectedLotIds;
      app.globalData.currentPackage = currentPackage;
      wx.setStorageSync('selectedPackageId', currentPackage.id);
      wx.setStorageSync('selectedPackageParkingLotIds', selectedLotIds);
      wx.setStorageSync('preferredParkingLotIds', selectedLotIds);
      wx.setStorageSync('currentPackage', currentPackage);

      wx.showToast({ title: '已选择套餐', icon: 'success' });
      setTimeout(() => {
        wx.switchTab({ url: '/pages/search/search' });
      }, 500);
    } catch (err) {
      console.error('选择套餐停车场失败:', err);
    } finally {
      this.setData({ submitting: false });
    }
  }
});
