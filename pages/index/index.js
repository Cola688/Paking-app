const app = getApp()
const api = require('../../utils/api.js')
const amap = require('../../utils/amap.js')
const { fixImageUrl } = require('../../utils/config.js')

const DEFAULT_LOCATION = {
  latitude: 22.543099,
  longitude: 114.057868
}

Page({
  data: {
    latitude: DEFAULT_LOCATION.latitude,
    longitude: DEFAULT_LOCATION.longitude,
    mapScale: 15,
    markers: [],
    markerParkingIdMap: {},
    nearbyParks: [],
    unreadCount: 0,
    currentAddress: '',
    locationReady: false,
    loadingParks: false
  },

  onLoad() {
    const token = wx.getStorageSync('token')
    if (!token) {
      this.redirectToLogin()
      return
    }
    app.globalData.hasLogin = true
    this.initHomeMap()
  },

  onShow() {
    const token = wx.getStorageSync('token')
    if (!token) {
      this.redirectToLogin()
      return
    }
    if (app.globalData.hasLogin) {
      this.initHomeMap()
    }
    this.loadUnreadCount()
  },

  redirectToLogin() {
    if (app.globalData.navigatingToLogin) return
    app.globalData.navigatingToLogin = true
    wx.redirectTo({
      url: '/pages/login/login',
      fail: () => {
        app.globalData.navigatingToLogin = false
      }
    })
  },

  async initHomeMap() {
    if (this.homeMapLoading) {
      return
    }

    this.homeMapLoading = true
    try {
      const location = await this.locateCurrentPosition()
      await this.loadMapInfo(location)
      this.homeMapLoaded = true
    } finally {
      this.homeMapLoading = false
    }
  },

  locateCurrentPosition() {
    return new Promise((resolve) => {
      wx.getLocation({
        type: 'gcj02',
        isHighAccuracy: true,
        highAccuracyExpireTime: 3000,
        success: async (res) => {
          const location = {
            latitude: res.latitude,
            longitude: res.longitude
          }

          app.globalData.currentLocation = location
          wx.setStorageSync('currentLocation', location)
          this.setData({
            ...location,
            locationReady: true,
            mapScale: 16
          })
          this.moveMapToLocation(location)
          this.loadCurrentAddress(location)
          resolve(location)
        },
        fail: () => {
          const cachedLocation = wx.getStorageSync('currentLocation')
          const location = cachedLocation?.latitude && cachedLocation?.longitude
            ? cachedLocation
            : DEFAULT_LOCATION

          this.setData({
            latitude: location.latitude,
            longitude: location.longitude,
            locationReady: Boolean(cachedLocation),
            mapScale: 15
          })
          resolve(location)
        }
      })
    })
  },

  async loadCurrentAddress(location) {
    try {
      const res = await amap.regeo(location.latitude, location.longitude)
      const address = res?.regeocode?.formatted_address || ''
      this.setData({ currentAddress: address })
    } catch (err) {
      console.warn('高德逆地理解析失败:', err)
      this.setData({ currentAddress: '' })
    }
  },

  async loadMapInfo(location = DEFAULT_LOCATION) {
    this.setData({ loadingParks: true })

    try {
      const res = await api.getParkingMapPoints()
      const parks = (res?.data || [])
        .map(item => this.normalizeParkingPoint(item, location))
        .filter(Boolean)
        .sort((a, b) => {
          // 繁忙（无空闲车位）的往后排
          const aBusy = a.available <= 0 ? 1 : 0
          const bBusy = b.available <= 0 ? 1 : 0
          if (aBusy !== bBusy) return aBusy - bBusy
          // 同组内按距离排序
          return a.distanceValue - b.distanceValue
        })

      const markerParkingIdMap = {}
      const markers = parks
        .filter(park => park.latitude !== null && park.longitude !== null)
        .map((park, index) => {
          const markerId = index + 1
          markerParkingIdMap[markerId] = park.id
          return {
            id: markerId,
            latitude: park.latitude,
            longitude: park.longitude,
            width: 34,
            height: 34,
            iconPath: '/images/marker.png',
            callout: {
              content: park.name,
              color: '#333',
              fontSize: 13,
              borderRadius: 8,
              bgColor: '#fff',
              padding: 8,
              display: 'BYCLICK'
            }
          }
        })

      this.setData({
        markers,
        markerParkingIdMap,
        nearbyParks: parks
      })
    } catch (err) {
      console.error('加载首页停车点位失败:', err)
      wx.showToast({ title: '停车点位加载失败', icon: 'none' })
      this.setData({
        markers: [],
        markerParkingIdMap: {},
        nearbyParks: []
      })
    } finally {
      this.setData({ loadingParks: false })
    }
  },

  normalizeParkingPoint(item, location) {
    const latitude = this.toNumber(item.latitude)
    const longitude = this.toNumber(item.longitude)
    const available = Math.max(this.toNumber(item.remainingSpotCount ?? item.available ?? item.sharedSpotCount) || 0, 0)
    const total = Math.max(this.toNumber(item.total ?? item.totalSpotCount) || 0, 0)
    const offPeakTotal = Math.max(this.toNumber(item.offPeakSpotCount ?? item.sharedSpotCount) || 0, 0)
    const distanceValue = latitude !== null && longitude !== null
      ? this.getDistance(location.latitude, location.longitude, latitude, longitude)
      : Number.MAX_SAFE_INTEGER

    return {
      id: String(item.id),
      parkingLotId: item.parkingLotId ? String(item.parkingLotId) : '',
      name: item.name || item.parkingAreaName || item.spotCode || '停车点位',
      status: available > 0 ? '空闲' : '繁忙',
      address: item.address || item.locationDescription || '暂无地址',
      distance: this.formatDistance(distanceValue),
      distanceValue,
      available,
      total,
      offPeakTotal,
      latitude,
      longitude,
      price: this.toNumber(item.price) || 0,
      imgUrl: fixImageUrl(item.imageUrl) || '/images/car.png'
    }
  },

  moveMapToLocation(location) {
    try {
      wx.createMapContext('parkingMap', this).moveToLocation({
        latitude: location.latitude,
        longitude: location.longitude
      })
    } catch (e) {}
  },

  toNumber(value) {
    if (value === null || value === undefined || value === '') {
      return null
    }

    const numberValue = Number(value)
    return Number.isFinite(numberValue) ? numberValue : null
  },

  getDistance(fromLat, fromLng, toLat, toLng) {
    const rad = value => value * Math.PI / 180
    const earthRadius = 6378137
    const dLat = rad(toLat - fromLat)
    const dLng = rad(toLng - fromLng)
    const a = Math.sin(dLat / 2) ** 2
      + Math.cos(rad(fromLat)) * Math.cos(rad(toLat)) * Math.sin(dLng / 2) ** 2
    return Math.round(earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)))
  },

  formatDistance(distance) {
    if (!Number.isFinite(distance) || distance === Number.MAX_SAFE_INTEGER) {
      return '未知'
    }

    if (distance >= 1000) {
      return `${(distance / 1000).toFixed(1)}km`
    }

    return `${distance}m`
  },

  async loadUnreadCount() {
    try {
      const res = await api.getNoticeUnreadCount()
      this.setData({ unreadCount: res?.data?.total || 0 })
    } catch (err) {
      console.error('加载通知未读数失败:', err)
      this.setData({ unreadCount: 0 })
    }
  },

  handleGoParking(e) {
    const id = e.currentTarget.dataset.id
    const park = this.data.nearbyParks.find(item => item.id === String(id))
    if (!park || park.latitude === null || park.longitude === null) {
      wx.showToast({ title: '该点位暂无经纬度', icon: 'none' })
      return
    }

    wx.openLocation({
      latitude: park.latitude,
      longitude: park.longitude,
      name: park.name,
      address: park.address,
      scale: 18
    })
  },

  onMarkerTap(e) {
    const markerId = e.detail.markerId
    const parkId = this.data.markerParkingIdMap[markerId]
    const park = this.data.nearbyParks.find(p => p.id === String(parkId))
    if (park) {
      this.goToParkingDetail({ currentTarget: { dataset: { id: park.id } } })
    }
  },

  goToParkingDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: '/pages/parkingDetail/parkingDetail?id=' + id
    })
  },

  goToSearch() {
    wx.navigateTo({
      url: '/pages/search/search'
    })
  },

  goToNotice() {
    wx.navigateTo({
      url: '/pages/notice/notice'
    })
  },

  goToParkingMap() {
    wx.navigateTo({
      url: '/pages/parkingMap/parkingMap'
    })
  }
})
