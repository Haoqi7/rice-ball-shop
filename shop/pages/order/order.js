const db = wx.cloud.database();

Page({
  data: {
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
    this.loadRecentOrders(); 
    this.setData({ remark: "", inputPwd: "", showSubmitModal: false });
  },

  loadMenu() {
    wx.showLoading({ title: '加载菜单...' });
    db.collection('menu').where({ isOn: true }).get()
      .then(res => {
        wx.hideLoading();
        if (res.data.length > 0) {
          const list = res.data.map(item => ({ ...item, id: item._id }));
          this.setData({ menuList: list });
        } else {
          this.useFallbackMenu();
        }
      })
      .catch(() => {
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

  loadRecentOrders() {
    db.collection('orders')
      .orderBy('timestamp', 'desc')
      .limit(10) 
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
      })
      .catch(console.error);
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

    // 1. 下单前先申请“给自己的”通知权限 (保留给顾客的通知机会)
    const TEMPLATE_ID = ''; 
    wx.requestSubscribeMessage({
      tmplIds: [TEMPLATE_ID],
      complete: (res) => {
        this.doSubmitToCloud(orderItems);
      }
    });
  },

  // 抽离出的下单逻辑
  doSubmitToCloud(orderItems) {
    wx.showLoading({ title: '下单中...' });

    let dishSummary = orderItems.map(i => `${i.name}x${i.count}`).join(',');
    if (dishSummary.length > 18) dishSummary = dishSummary.substring(0, 18) + '...';
    
    const timeStr = new Date().toLocaleString();

    const newOrder = {
      timeStr: timeStr,
      items: orderItems,
      dishSummary: dishSummary, 
      remark: this.data.remark,
      status: 'pending',
      timestamp: Date.now()
    };

    db.collection('orders').add({
      data: newOrder,
      success: res => {
        wx.hideLoading();
        wx.showToast({ title: '下单成功！', icon: 'success' });
        
        // 【核心修复】下单成功后，呼叫云函数通知后厨 (A和C)
        // 这里的 type: 'to_staff' 告诉云函数去查 subscribers 表
        wx.cloud.callFunction({
          name: 'sendMsg',
          data: {
            type: 'to_staff', 
            orderTime: timeStr,
            dishName: '新订单：' + dishSummary,
            remark: this.data.remark,
            status: '待制作'
          }
        }).catch(err => {
          console.error('通知后厨失败', err);
        });

        this.clearCart();
        this.hideSubmitModal();
        this.loadRecentOrders(); 
        wx.vibrateLong();
      },
      fail: err => {
        wx.hideLoading();
        wx.showToast({ title: '网络异常', icon: 'none' });
      }
    });
  }
})