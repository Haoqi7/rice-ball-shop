// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境
const db = cloud.database()
const _ = db.command

// 云函数入口函数
exports.main = async (event, context) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTs = today.getTime();

  try {
    // 物理删除所有 timestamp 小于今天凌晨的订单
    // 注意：云函数一次最多删除100条，如果数据量巨大需要循环，但家庭用通常够了
    return await db.collection('orders')
      .where({
        timestamp: _.lt(todayTs)
      })
      .remove()
  } catch(e) {
    console.error(e)
    return e
  }
}