const db = wx.cloud.database();
const _ = db.command;

Page({
  data: {
    // 【修改点】增加了 "炒菜"
    categories: ["主食", "炒菜", "配料", "饮品"],
    curCategory: "主食",
    menuList: [],
    cart: {}, 
    totalCount: 0,
    showCartDetail: false,
    showSubmitModal: false,
    remark: "",
    inputPwd: "",
    myRecentOrders: []
  },

  onShow() {
    this.loadMenu();
    this.loadMyOrders();
    this.setData({ remark: "", inputPwd: "", showSubmitModal: false });
  },

  loadMenu() {
    wx.showLoading({ title: '加载菜单...' });
    db.collection('menu').where({
      isOn: true 
    }).get().then(res => {
      wx.hideLoading();
      if (res.data.length > 0) {
        const list = res.data.map(item => ({ ...item, id: item._id }));
        this.setData({ menuList: list });
      } else {
        this.useFallbackMenu();
      }
    }).catch(err => {
      wx.hideLoading();
      this.useFallbackMenu();
    });
  },

  useFallbackMenu() {
    const fallbackMenu = [
      { id: 'local_1', name: "肉松饭团", intro: "经典口味(离线)", category: "主食", isOn: true },
      { id: 'local_2', name: "小炒肉", intro: "香辣下饭(离线)", category: "炒菜", isOn: true },
      { id: 'local_3', name: "豆浆", intro: "现磨热豆浆", category: "饮品", isOn: true }
    ];
    this.setData({ menuList: fallbackMenu });
  },

  loadMyOrders() {
    const myIds = wx.getStorageSync('my_cloud_ids') || [];
    if (myIds.length === 0) {
      this.setData({ myRecentOrders: [] });
      return;
    }

    db.collection('orders')
      .where({ _id: _.in(myIds) })
      .orderBy('timestamp', 'desc')
      .limit(20) // 稍微增加拉取数量
      .get()
      .then(res => {
        const now = Date.now();
        const list = res.data.map(o => {
          let statusText = "待制作";
          if(o.status === 'making') statusText = "制作中";
          if(o.status === 'finished') statusText = "已完成";
          
          const isTimeValid = (now - o.timestamp) < 5 * 60 * 1000;
          const canCancel = (o.status === 'pending') && isTimeValid;

          return { ...o, id: o._id, statusText, canCancel };
        });
        this.setData({ myRecentOrders: list });
      });
  },

  navToDetail(e) {
    const id = e.currentTarget.dataset.id;
    if (id) wx.navigateTo({ url: `/pages/order-detail/order-detail?id=${id}` });
  },

  switchCategory(e) { this.setData({ curCategory: e.currentTarget.dataset.cat }); },

  updateCart(e) {
    const { id, op } = e.currentTarget.dataset;
    const opVal = parseInt(op);
    let cart = this.data.cart;
    let currentCount = cart[id] || 0;
    currentCount += opVal;
    if (currentCount < 0) currentCount = 0;
    if (currentCount === 0) delete cart[id];
    else cart[id] = currentCount;
    this.setData({ cart });
    this.calcTotal();
    wx.vibrateShort({ type: 'light' });
  },

  calcTotal() {
    let count = 0;
    Object.values(this.data.cart).forEach(v => count += v);
    this.setData({ totalCount: count });
    if (count === 0) this.setData({ showCartDetail: false });
  },

  showCartDetail() { if (this.data.totalCount > 0) this.setData({ showCartDetail: true }); },
  clearCart() { this.setData({ cart: {}, totalCount: 0, showCartDetail: false }); },
  showSubmitModal() { this.setData({ showSubmitModal: true }); },
  hideSubmitModal() { this.setData({ showSubmitModal: false }); },
  inputRemark(e) { this.setData({ remark: e.detail.value }); },
  inputPwd(e) { this.setData({ inputPwd: e.detail.value }); },

  submitOrder() {
    const config = wx.getStorageSync('sys_config');
    if (this.data.inputPwd != config.orderPwd) {
      wx.showToast({ title: '订单密码错误', icon: 'none' });
      return;
    }

    const orderItems = [];
    this.data.menuList.forEach(item => {
      if (this.data.cart[item.id]) {
        orderItems.push({
          name: item.name,
          count: this.data.cart[item.id]
        });
      }
    });

    if (orderItems.length === 0) {
      wx.showToast({ title: '购物车是空的', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '下单中...' });

    const newOrder = {
      timeStr: new Date().toLocaleString(),
      items: orderItems,
      remark: this.data.remark,
      status: 'pending',
      timestamp: Date.now()
    };

    db.collection('orders').add({
      data: newOrder,
      success: res => {
        const myIds = wx.getStorageSync('my_cloud_ids') || [];
        myIds.push(res._id); 
        wx.setStorageSync('my_cloud_ids', myIds);

        wx.hideLoading();
        wx.showToast({ title: '下单成功！', icon: 'success' });
        this.clearCart();
        this.hideSubmitModal();
        this.loadMyOrders(); 
        wx.vibrateLong();
      },
      fail: err => {
        wx.hideLoading();
        wx.showToast({ title: '网络异常', icon: 'none' });
      }
    });
  }
})