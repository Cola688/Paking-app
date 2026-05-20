Page({
  data: {
    parking: {
      status: 'idle',
      statusText: '暂无停车',
      plateNumber: '',
      parkingName: '',
      enterTime: '',
      duration: '',
      fee: '0.00'
    }
  },

  onLoad() {
    this.checkParkingStatus();
  },

  onShow() {
    this.checkParkingStatus();
  },

  checkParkingStatus() {
    const parkingData = wx.getStorageSync('currentParking');
    if (parkingData) {
      this.setData({
        parking: {
          status: 'parking',
          statusText: '停车中',
          plateNumber: parkingData.plateNumber,
          parkingName: parkingData.parkingName,
          enterTime: parkingData.enterTime,
          duration: parkingData.duration,
          fee: parkingData.fee
        }
      });
    } else {
      this.setData({
        parking: {
          status: 'idle',
          statusText: '暂无停车'
        }
      });
    }
  },

  endParking() {
    wx.showModal({
      title: '确认结束停车',
      content: '是否确认结束当前停车？',
      success: (res) => {
        if (res.confirm) {
          // 实际应调用结算接口
          const fee = this.data.parking.fee;
          wx.showModal({
            title: '停车费用',
            content: `应支付 ¥${fee}`,
            showCancel: false,
            success: () => {
              wx.removeStorageSync('currentParking');
              this.checkParkingStatus();
            }
          });
        }
      }
    });
  },

  addCar() {
    wx.showToast({ title: '请先在"我的车辆"中添加车辆', icon: 'none' });
  }
});
