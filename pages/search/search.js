const app = getApp();
const api = require('../../utils/api.js');

const DEFAULT_LOCATION = {
  latitude: 22.543099,
  longitude: 114.057868
};

Page({
  data: {
    keyword: '',
    sortType: 'smart',
    currentLocationText: '定位中',
    reservableCount: 0,
    searchResult: [],
    showEmpty: false,
    loading: false
  },

  onLoad() {
    this.loadReservableParks();
  },

  onShow() {
    this.loadReservableParks();
  },

  onSearchInput(e) {
    this.setData({ keyword: e.detail.value });
    this.applyFilterAndSort();
  },

  onSearch() {
    this.applyFilterAndSort();
  },

  clearSearch() {
    this.setData({ keyword: '' });
    this.applyFilterAndSort();
  },

  toggleSort(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({ sortType: type });
    this.applyFilterAndSort();
  },

  async loadReservableParks() {
    if (this.loadingParks) {
      return;
    }

    this.loadingParks = true;
    this.setData({ loading: true });
    try {
      const location = await this.getCurrentLocation();
      const res = await api.getParkingMapPoints();
      this.allParks = (res?.data || [])
        .map(item => this.normalizeParkingPoint(item, location))
        .filter(item => item && item.available > 0);

      this.setData({
        currentLocationText: location.isLocated ? '已按当前位置推荐' : '定位失败，按默认位置推荐',
        reservableCount: this.allParks.length
      });
      this.applyFilterAndSort();
    } catch (err) {
      console.error('加载可预约车位失败:', err);
      this.allParks = [];
      this.setData({
        searchResult: [],
        showEmpty: true
      });
      wx.showToast({ title: '停车场加载失败', icon: 'none' });
    } finally {
      this.loadingParks = false;
      this.setData({ loading: false });
    }
  },

  getCurrentLocation() {
    return new Promise(resolve => {
      wx.getLocation({
        type: 'gcj02',
        isHighAccuracy: true,
        highAccuracyExpireTime: 3000,
        success: res => {
          const location = {
            isLocated: true,
            latitude: res.latitude,
            longitude: res.longitude
          };
          app.globalData.currentLocation = location;
          wx.setStorageSync('currentLocation', location);
          resolve(location);
        },
        fail: () => {
          const cached = wx.getStorageSync('currentLocation');
          if (cached?.latitude && cached?.longitude) {
            resolve({
              isLocated: true,
              latitude: cached.latitude,
              longitude: cached.longitude
            });
            return;
          }

          resolve({
            isLocated: false,
            ...DEFAULT_LOCATION
          });
        }
      });
    });
  },

  normalizeParkingPoint(item, location) {
    const latitude = this.toNumber(item.latitude);
    const longitude = this.toNumber(item.longitude);
    const available = Math.max(this.toNumber(item.remainingSpotCount ?? item.available ?? item.sharedSpotCount) || 0, 0);
    const total = Math.max(this.toNumber(item.offPeakSpotCount ?? item.total ?? item.totalSpotCount) || 0, 0);
    const distanceValue = latitude !== null && longitude !== null
      ? this.getDistance(location.latitude, location.longitude, latitude, longitude)
      : Number.MAX_SAFE_INTEGER;
    const id = String(item.id);

    return {
      id,
      parkingLotId: item.parkingLotId ? String(item.parkingLotId) : '',
      name: item.name || item.parkingAreaName || item.spotCode || '停车点位',
      address: item.address || item.locationDescription || '暂无地址',
      available,
      total,
      price: this.toNumber(item.price) || 0,
      distance: this.formatDistance(distanceValue),
      distanceValue,
      hasEV: item.chargingPileSupported === true,
      latitude,
      longitude,
      spotCode: item.spotCode || ''
    };
  },

  applyFilterAndSort() {
    const keyword = this.data.keyword.trim();
    const result = (this.allParks || [])
      .filter(item => {
        if (!keyword) return true;
        return item.name.includes(keyword)
          || item.address.includes(keyword)
          || item.spotCode.includes(keyword);
      })
      .sort((a, b) => this.comparePark(a, b));

    this.setData({
      searchResult: result,
      showEmpty: result.length === 0
    });
  },

  comparePark(a, b) {
    if (this.data.sortType === 'price') {
      return a.price - b.price || a.distanceValue - b.distanceValue;
    }

    if (this.data.sortType === 'available') {
      return b.available - a.available || a.distanceValue - b.distanceValue;
    }

    return a.distanceValue - b.distanceValue || b.available - a.available;
  },

  toNumber(value) {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : null;
  },

  getDistance(fromLat, fromLng, toLat, toLng) {
    const rad = value => value * Math.PI / 180;
    const earthRadius = 6378137;
    const dLat = rad(toLat - fromLat);
    const dLng = rad(toLng - fromLng);
    const a = Math.sin(dLat / 2) ** 2
      + Math.cos(rad(fromLat)) * Math.cos(rad(toLat)) * Math.sin(dLng / 2) ** 2;
    return Math.round(earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  },

  formatDistance(distance) {
    if (!Number.isFinite(distance) || distance === Number.MAX_SAFE_INTEGER) {
      return '未知';
    }

    if (distance >= 1000) {
      return `${(distance / 1000).toFixed(1)}km`;
    }

    return `${distance}m`;
  },

  goToDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/parkingDetail/parkingDetail?id=${id}`
    });
  },

  reserveParking(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/parkingDetail/parkingDetail?id=${id}`
    });
  },

  navigateTo(e) {
    const id = e.currentTarget.dataset.id;
    const park = (this.data.searchResult || []).find(item => item.id === String(id));
    if (!park || park.latitude == null || park.longitude == null) {
      wx.showToast({ title: '暂无位置信息', icon: 'none' });
      return;
    }
    wx.openLocation({
      latitude: park.latitude,
      longitude: park.longitude,
      name: park.name,
      address: park.address,
      scale: 18
    });
  }
});
