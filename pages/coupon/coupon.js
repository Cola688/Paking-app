Page({
  data: {
    coupons: [
      { id: 1, name: '新用户专享券', value: '5', condition: '满10元可用', expireDate: '2024-02-28', status: 'available' },
      { id: 2, name: '停车优惠券', value: '3', condition: '满20元可用', expireDate: '2024-02-15', status: 'available' },
      { id: 3, name: '会员专享券', value: '10', condition: '满50元可用', expireDate: '2024-01-10', status: 'used' },
      { id: 4, name: '限时优惠', value: '2', condition: '无门槛', expireDate: '2023-12-31', status: 'expired' }
    ]
  }
});
