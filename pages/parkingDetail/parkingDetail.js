const api = require('../../utils/api.js');

Page({
  data: {
    parkingInfo: {}
  },

  onLoad(options) {
    this.loadParkingInfo(options.id);
  },

  async loadParkingInfo(id) {
    if (!id) {
      wx.showToast({ title: '缺少点位ID', icon: 'none' });
      return;
    }

    try {
      const res = await api.getParkingMapPointDetail(id);
      const parkingInfo = this.normalizeParkingInfo(res?.data || {});
      this.setData({ parkingInfo });
    } catch (err) {
      console.error('加载停车点位详情失败:', err);
      wx.showToast({ title: '详情加载失败', icon: 'none' });
    }
  },

  normalizeParkingInfo(item) {
    const totalSpaces = this.toNumber(item.total) || 0;
    const available = this.toNumber(item.available) || 0;
    return {
      id: String(item.id),
      parkingLotId: item.parkingLotId ? String(item.parkingLotId) : '',
      name: item.name || item.parkingAreaName || item.spotCode || '停车点位',
      address: item.address || item.locationDescription || '',
      totalSpaces,
      available,
      firstHourPrice: this.toNumber(item.price) || 0,
      overTimePrice: this.toNumber(item.price) || 0,
      hasDiscount: false,
      is24Hour: true,
      hasEV: item.chargingPileSupported === true,
      lat: this.toNumber(item.latitude),
      lng: this.toNumber(item.longitude),
      remark: item.remark || ''
    };
  },

  toNumber(value) {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : null;
  },

  goBack() {
    wx.navigateBack();
  },

  openMap() {
    const { lat, lng, name, address } = this.data.parkingInfo;
    if (lat === null || lng === null || lat === undefined || lng === undefined) {
      wx.showToast({ title: '该点位暂无经纬度', icon: 'none' });
      return;
    }

    wx.openLocation({
      latitude: lat,
      longitude: lng,
      name,
      address,
      scale: 18
    });
  },

  startParking() {
    wx.navigateTo({ url: '/pages/parking/parking' });
  },

  goParkingMap() {
    wx.navigateTo({ url: `/pages/parkingMap/parkingMap?id=${this.data.parkingInfo.id}` });
  }
});
