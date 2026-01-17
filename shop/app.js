App({
  onLaunch() {
    // 1. 初始化云开发
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    } else {
      wx.cloud.init({
        traceUser: true,
      });
    }

    // 2. 初始化本地基础配置 (密码等)
    const isInit = wx.getStorageSync('is_init');
    if (!isInit) {
      const defaultConfig = {
        shopName: "家用饭团小铺",
        welcomeMsg: "欢迎回家，今天想吃点什么？",
        notice: "下单须知：仅限家庭成员点单，接头暗号请咨询大厨。",
        orderPwd: "666", 
        adminPwd: "123456",
        recoveryQuestion: "家里的宠物名字",
        recoveryAnswer: "旺财",
      };
      wx.setStorageSync('sys_config', defaultConfig);
      wx.setStorageSync('is_init', true);
    }

    // 3. 【核心逻辑】检查并初始化云端菜单
    // 逻辑：云端有 -> 用云端的；云端无 -> 上传内置的
    this.initCloudMenu();
  },

  initCloudMenu() {
    const db = wx.cloud.database();
    db.collection('menu').count().then(res => {
      // 如果云端一条数据都没有，说明是第一次运行，或者被清空了
      if (res.total === 0) {
        console.log('云端菜单为空，正在同步内置菜单到云端...');
        const defaultMenu = [
          { name: "炒米饭", intro: "经典口味，满满蛋液", category: "主食", isOn: true },
          { name: "炒面条", intro: "一碗蛋炒面", category: "主食", isOn: true },
          { name: "鱼香肉丝", intro: "家常口味", category: "炒菜", isOn: true },
          { name: "豆角茄子", intro: "家常口味", category: "炒菜", isOn: true },
          { name: "火腿肠", intro: "普通切片", category: "配料", isOn: true },
          { name: "拍黄瓜", intro: "家常口味", category: "配料", isOn: true },
          { name: "花生米", intro: "家常口味", category: "配料", isOn: true },
          { name: "啤酒", intro: "常温", category: "饮品", isOn: true },
          { name: "豆浆", intro: "现磨热豆浆", category: "饮品", isOn: true }
        ];
        
        // 逐条上传
        defaultMenu.forEach(item => {
          db.collection('menu').add({ data: item });
        });
      }
    }).catch(err => {
      console.error("检查云端菜单失败，可能是网络问题或集合未创建", err);
    });
  }
})