const app = getApp();
const api = require('../../utils/api.js');
const amap = require('../../utils/amap.js');

const QUICK_PROMPTS = [
  '帮我找附近空闲车位',
  '共享申请怎么提交',
  '怎么导航到停车场',
  '停车收费怎么看'
];

const MAX_CONTEXT_MESSAGES = 12;

Page({
  data: {
    inputValue: '',
    loading: false,
    messages: [
      {
        id: 1,
        role: 'assistant',
        text: '你好，我是停车 AI 助手。可以帮你快速了解附近停车、导航、共享申请和停车规则。'
      }
    ],
    quickPrompts: QUICK_PROMPTS,
    scrollIntoView: 'msg-1'
  },

  onLoad() {
    this.sessionId = this.createSessionId();
  },

  onUnload() {
    this.abortStream();
  },

  onInput(e) {
    this.setData({ inputValue: e.detail.value });
  },

  onQuickPrompt(e) {
    const text = e.currentTarget.dataset.text;
    if (!text) {
      return;
    }
    this.sendText(text);
  },

  onSend() {
    this.sendText(this.data.inputValue);
  },

  async sendText(value) {
    const text = String(value || '').trim();
    if (!text || this.data.loading) {
      return;
    }

    const userMessage = this.createMessage('user', text);
    const conversationMessages = [...this.data.messages, userMessage];
    const assistantMessage = this.createMessage('assistant', '', {
      cards: [],
      streaming: true
    });
    const messages = [...conversationMessages, assistantMessage];

    this.setData({
      inputValue: '',
      loading: true,
      messages,
      scrollIntoView: `msg-${assistantMessage.id}`
    });

    const location = await this.obtainLocation();

    const stream = api.streamAiChat({
      sessionId: this.sessionId,
      messages: this.buildChatMessages(conversationMessages),
      latitude: location.latitude,
      longitude: location.longitude,
      locationAddress: location.address,
      onFrame: frame => this.handleStreamFrame(frame, assistantMessage.id)
    });

    this.chatStream = stream;
    stream.promise
      .then(() => this.finishAssistant(assistantMessage.id))
      .catch(err => this.failAssistant(assistantMessage.id, err))
      .finally(() => {
        if (this.chatStream === stream) {
          this.chatStream = null;
        }
        this.setData({ loading: false });
      });
  },

  obtainLocation() {
    return new Promise((resolve) => {
      const fallback = { latitude: null, longitude: null, address: '' };

      wx.getLocation({
        type: 'gcj02',
        isHighAccuracy: true,
        highAccuracyExpireTime: 3000,
        success: async (res) => {
          const location = {
            latitude: res.latitude,
            longitude: res.longitude
          };
          app.globalData.currentLocation = location;
          wx.setStorageSync('currentLocation', location);

          let address = '';
          try {
            const regeoRes = await amap.regeo(location.latitude, location.longitude);
            address = regeoRes?.regeocode?.formatted_address || '';
            if (!address) {
              console.warn('逆地理编码返回空地址, 完整响应:', JSON.stringify(regeoRes));
            }
          } catch (e) {
            console.error('逆地理编码失败:', JSON.stringify(e));
            wx.showToast({ title: '定位解析失败，请检查网络', icon: 'none', duration: 2000 });
          }
          resolve({ latitude: location.latitude, longitude: location.longitude, address });
        },
        fail: () => {
          const cached = app.globalData.currentLocation
            || wx.getStorageSync('currentLocation');
          if (cached?.latitude && cached?.longitude) {
            resolve({ latitude: cached.latitude, longitude: cached.longitude, address: '' });
          } else {
            resolve(fallback);
          }
        }
      });
    });
  },

  createMessage(role, text, extra = {}) {
    return {
      id: Date.now() + Math.floor(Math.random() * 1000),
      role,
      text,
      ...extra
    };
  },

  buildChatMessages(messages) {
    return messages
      .filter(item => (item.role === 'user' || item.role === 'assistant') && item.text)
      .slice(-MAX_CONTEXT_MESSAGES)
      .map(item => ({
        role: item.role,
        content: item.text
      }));
  },

  handleStreamFrame(frame, messageId) {
    if (!frame || !frame.type) {
      return;
    }

    if (frame.type === 'delta') {
      const content = frame.data?.content || '';
      if (content) {
        this.appendAssistantText(messageId, content);
      }
      return;
    }

    if (frame.type === 'tool_result') {
      const cards = this.normalizeToolCards(frame.data);
      if (cards.length) {
        this.appendAssistantCards(messageId, cards);
      }
    }
  },

  appendAssistantText(messageId, content) {
    this.updateMessage(messageId, item => ({
      text: `${item.text || ''}${content}`,
      streaming: true
    }));
  },

  appendAssistantCards(messageId, cards) {
    this.updateMessage(messageId, item => {
      const existed = item.cards || [];
      const existedKeys = existed.map(card => card.key);
      const nextCards = [
        ...existed,
        ...cards.filter(card => !existedKeys.includes(card.key))
      ];
      return {
        cards: nextCards,
        streaming: true
      };
    });
  },

  finishAssistant(messageId) {
    this.updateMessage(messageId, item => {
      const hasText = Boolean((item.text || '').trim());
      const hasCards = Boolean(item.cards && item.cards.length);
      return {
        text: hasText
          ? item.text
          : hasCards
            ? '已为你整理了相关信息，详情见下方卡片。'
            : '我暂时没有拿到有效回复，请稍后再试。',
        streaming: false
      };
    });
  },

  failAssistant(messageId, err) {
    const message = err?.message || err?.msg || 'AI 暂时没有响应，请稍后再试。';
    this.updateMessage(messageId, item => ({
      text: item.text || message,
      streaming: false
    }));
  },

  updateMessage(messageId, updater) {
    const messages = this.data.messages.map(item => {
      if (item.id !== messageId) {
        return item;
      }
      return {
        ...item,
        ...updater(item)
      };
    });

    this.setData({
      messages,
      scrollIntoView: `msg-${messageId}`
    });
  },

  normalizeToolCards(frameData = {}) {
    const result = frameData.result || {};
    const items = Array.isArray(result.items)
      ? result.items
      : Array.isArray(result)
        ? result
        : [];
    const toolName = frameData.name || frameData.card?.type || '';

    return items
      .map((item, index) => this.normalizeCard(item, toolName, index))
      .filter(Boolean);
  },

  normalizeCard(item = {}, toolName = '', index = 0) {
    const title = this.compact(
      item.name
      || item.parkingLotName
      || item.productName
      || item.parkingAreaName
      || item.reservationNo
      || item.applicationNo
      || item.passNo
      || '相关信息'
    );
    let subtitle = this.compact(
      item.location
      || item.address
      || item.parkingAreaName
      || item.plateNumber
      || item.passTypeLabel
      || item.businessHours
      || ''
    );
    if (item.distance) {
      subtitle = subtitle ? `${subtitle} | 距您${item.distance}` : `距您${item.distance}`;
    }
    const rows = [];
    const tags = [];

    this.pushRow(rows, '可预约', this.formatCount(item.availableSpots, '个'));
    this.pushRow(rows, '总车位', this.formatCount(item.totalSpots, '个'));
    this.pushRow(rows, '价格', this.formatPrice(item.price, item.priceUnit));
    this.pushRow(rows, '月租', this.formatPrice(item.monthlyPrice, '月'));
    this.pushRow(rows, '营业', item.businessHours);
    this.pushRow(rows, '电话', item.contactPhone);
    this.pushRow(rows, '预约单', item.reservationNo);
    this.pushRow(rows, '入场', this.formatDateTime(item.reserveStartTime));
    this.pushRow(rows, '离场', this.formatDateTime(item.reserveEndTime));
    this.pushRow(rows, '申请单', item.applicationNo);
    this.pushRow(rows, '类型', item.applicationType);
    this.pushRow(rows, '共享数', this.formatShareCount(item));
    this.pushRow(rows, '有效期至', this.formatDateTime(item.validEndAt));
    this.pushRow(rows, '可选停车场', this.formatCount(item.maxSelectLotCount, '个'));
    this.pushRow(rows, '可绑车辆', this.formatCount(item.maxBindVehicleCount, '辆'));

    [item.statusLabel, item.auditStatus, item.passTypeLabel].forEach(label => {
      if (this.isPresent(label) && !tags.includes(label)) {
        tags.push(String(label));
      }
    });
    if (item.chargingPileSupported === true) {
      tags.push('充电桩');
    }

    const action = this.resolveCardAction(item);
    const nav = this.resolveCardNavigation(item);
    return {
      key: `${toolName}-${item.id || item.reservationNo || item.applicationNo || item.passNo || index}`,
      typeLabel: this.resolveCardType(toolName),
      title,
      subtitle,
      tags: tags.slice(0, 3),
      rows: rows.slice(0, 6),
      actionText: action.text,
      actionUrl: action.url,
      navEnabled: nav.enabled,
      navLatitude: nav.latitude,
      navLongitude: nav.longitude,
      navName: nav.name
    };
  },

  pushRow(rows, label, value) {
    if (!this.isPresent(value)) {
      return;
    }
    rows.push({
      label,
      value: String(value)
    });
  },

  isPresent(value) {
    return value !== null && value !== undefined && value !== '';
  },

  formatCount(value, unit) {
    if (!this.isPresent(value)) {
      return '';
    }
    return `${value}${unit}`;
  },

  formatPrice(price, unit) {
    if (!this.isPresent(price)) {
      return '';
    }
    return `¥${price}${unit ? `/${unit}` : ''}`;
  },

  formatShareCount(item) {
    if (!this.isPresent(item.sharedSpotCount) && !this.isPresent(item.totalSpotCount)) {
      return '';
    }
    return `${item.sharedSpotCount || 0}/${item.totalSpotCount || 0}个`;
  },

  formatDateTime(value) {
    if (!this.isPresent(value)) {
      return '';
    }
    if (Array.isArray(value)) {
      const [year, month, day, hour = 0, minute = 0] = value;
      return `${year}-${this.pad(month)}-${this.pad(day)} ${this.pad(hour)}:${this.pad(minute)}`;
    }
    return String(value).replace('T', ' ').slice(0, 16);
  },

  pad(value) {
    return String(value).padStart(2, '0');
  },

  compact(value) {
    return String(value || '').trim();
  },

  resolveCardType(toolName) {
    const typeMap = {
      query_available_parking_lots: '可预约停车场',
      query_parking_lots_by_feature: '停车场推荐',
      query_parking_lot_detail: '停车场详情',
      query_parking_price: '停车收费',
      query_my_reservations: '我的预约',
      query_my_share_applications: '共享申请',
      query_my_parking_pass: '停车权益'
    };
    return typeMap[toolName] || '相关信息';
  },

  resolveCardAction(item) {
    if (item.actionUrl) {
      return {
        text: item.actionText || '查看',
        url: item.actionUrl
      };
    }
    if (item.mapPointId) {
      return {
        text: '查看详情',
        url: `/pages/parkingDetail/parkingDetail?id=${item.mapPointId}`
      };
    }
    return { text: '', url: '' };
  },

  resolveCardNavigation(item) {
    const lat = this.toNum(item.latitude);
    const lng = this.toNum(item.longitude);
    if (lat === null || lng === null) {
      return { enabled: false, latitude: null, longitude: null, name: '' };
    }
    return {
      enabled: true,
      latitude: lat,
      longitude: lng,
      name: item.name || item.parkingLotName || ''
    };
  },

  toNum(value) {
    if (value === null || value === undefined) {
      return null;
    }
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  },

  onCardAction(e) {
    const url = e.currentTarget.dataset.url;
    if (!url) {
      return;
    }
    wx.navigateTo({ url });
  },

  onCardNavigate(e) {
    const { latitude, longitude, name } = e.currentTarget.dataset;
    if (latitude == null || longitude == null) {
      return;
    }
    wx.openLocation({
      latitude,
      longitude,
      name: name || '',
      scale: 18
    });
  },

  abortStream() {
    if (this.chatStream) {
      this.chatStream.abort();
      this.chatStream = null;
    }
  },

  createSessionId() {
    return `mp-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  }
});
