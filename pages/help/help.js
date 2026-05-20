Page({
  data: {
    helps: [
      { id: 1, question: '如何扫码停车？', answer: '点击首页"扫码停车"按钮，扫描停车场二维码即可开始停车。', open: false },
      { id: 2, question: '如何缴纳停车费？', answer: '停车结束后，可在"我的-停车记录"中查看并支付停车费用。', open: false },
      { id: 3, question: '支持哪些支付方式？', answer: '目前支持微信支付，后续将支持更多支付方式。', open: false }
    ]
  },
  toggleHelp(e) {
    const id = e.currentTarget.dataset.id;
    const helps = this.data.helps.map(item => {
      if (item.id === id) item.open = !item.open;
      return item;
    });
    this.setData({ helps });
  }
});
