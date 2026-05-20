Page({
  data: {
    latitude: 31.230416,
    longitude: 121.473701,
    markers: [],
    polyline: [],
    destination: {
      name: '共和新路停车场',
      address: '共和新路1000号',
      distance: '350m',
      lat: 31.235,
      lng: 121.475
    }
  },

  onLoad() {
    this.getLocation();
  },

  getLocation() {
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        this.setData({
          latitude: res.latitude,
          longitude: res.longitude
        });
        this.setMarkers();
        this.setPolyline();
      }
    });
  },

  setMarkers() {
    const dest = this.data.destination;
    this.setData({
      markers: [{
        id: 1,
        latitude: dest.lat,
        longitude: dest.lng,
        width: 40,
        height: 40,
        iconPath: '/images/marker.png'
      }]
    });
  },

  setPolyline() {
    const start = { lat: this.data.latitude, lng: this.data.longitude };
    const end = { lat: this.data.destination.lat, lng: this.data.destination.lng };
    
    // 简单直线
    this.setData({
      polyline: [{
        points: [
          { latitude: start.lat, longitude: start.lng },
          { latitude: end.lat, longitude: end.lng }
        ],
        color: '#1989fa',
        width: 4
      }]
    });
  },

  startNavi() {
    const dest = this.data.destination;
    wx.openLocation({
      latitude: dest.lat,
      longitude: dest.lng,
      name: dest.name,
      address: dest.address,
      scale: 18
    });
  },

  chooseLocation() {
    wx.chooseLocation({
      success: (res) => {
        this.setData({
          destination: {
            name: res.name || '选择的位置',
            address: res.address,
            distance: '未知',
            lat: res.latitude,
            lng: res.longitude
          }
        });
        this.setMarkers();
        this.setPolyline();
      }
    });
  }
});
