const db = wx.cloud.database();

Page({
  data: {
    orderId: null,
    order: null,
    canCancel: false,
    stepIndex: 0, // 0:待接单, 1:制作中, 2:已完成
    watcher: null
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ orderId: options.id });
      this.initWatcher(options.id);
    }
  },

  onUnload() {
    if (this.data.watcher) {
      this.data.watcher.close();
    }
  },

  initWatcher(id) {
    wx.showLoading({ title: '同步状态...' });
    
    // 实时监听订单状态变化
    this.data.watcher = db.collection('orders').doc(id).watch({
      onChange: snapshot => {
        wx.hideLoading();
        if (snapshot.docs && snapshot.docs.length > 0) {
          const order = snapshot.docs[0];
          this.processOrderData(order);
        } else {
          // 订单被删除了（可能是后厨删的，或者是自己刚刚取消的）
          if (this.data.order) { 
             wx.showToast({ title: '订单已不存在', icon: 'none' });
             setTimeout(() => { wx.navigateBack(); }, 1500);
          }
        }
      },
      onError: err => {
        console.error("监听失败", err);
        wx.hideLoading();
      }
    });
  },

  // 【核心修复】状态判断逻辑：确保状态互斥
  processOrderData(order) {
    let statusText = "";
    let stepIndex = 0;

    switch (order.status) {
      case 'finished':
        statusText = "制作完成，请享用！";
        stepIndex = 2; 
        break;
      case 'making':
        statusText = "大厨正在制作中...";
        stepIndex = 1;
        break;
      case 'pending':
      default:
        statusText = "等待大厨接单";
        stepIndex = 0;
        break;
    }
    
    order.statusText = statusText;

    // 计算是否可取消 (必须是 pending 且 5分钟内)
    const now = Date.now();
    const orderTime = typeof order.timestamp === 'number' ? order.timestamp : parseInt(order.timestamp);
    const isTimeValid = (now - orderTime) < 5 * 60 * 1000;
    
    // 只有待接单状态 且 时间有效 才能取消
    const canCancel = (order.status === 'pending') && isTimeValid;

    this.setData({ 
      order: order, 
      canCancel: canCancel, 
      stepIndex: stepIndex 
    });
  },

  cancelOrder() {
    // 双重检查
    const now = Date.now();
    const orderTime = typeof this.data.order.timestamp === 'number' ? this.data.order.timestamp : parseInt(this.data.order.timestamp);
    if ((now - orderTime) > 5 * 60 * 1000) {
       wx.showToast({ title: '已超过5分钟，无法取消', icon: 'none' });
       this.setData({ canCancel: false });
       return;
    }

    wx.showModal({
      title: '取消订单',
      content: '确定要取消并重新下单吗？',
      confirmColor: '#ff0000',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '取消中' });
          
          db.collection('orders').doc(this.data.orderId).remove()
            .then(() => {
              // 清理本地ID缓存
              let myIds = wx.getStorageSync('my_cloud_ids') || [];
              myIds = myIds.filter(id => id !== this.data.orderId);
              wx.setStorageSync('my_cloud_ids', myIds);

              wx.hideLoading();
              wx.showToast({ title: '订单已取消', icon: 'success' });
              setTimeout(() => { wx.navigateBack(); }, 1000);
            })
            .catch(err => {
              wx.hideLoading();
              wx.showToast({ title: '取消失败', icon: 'none' });
            });
        }
      }
    });
  },

  goBack() {
    wx.navigateBack();
  }
})