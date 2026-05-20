# 共和新路街道停车联盟小程序

## 项目说明

这是一个微信原生小程序，用于共和新路街道停车联盟服务。

## 目录结构

```
parking-app/
├── pages/               # 页面目录
│   ├── index/          # 首页
│   ├── search/         # 找车位
│   ├── parking/        # 停车页面
│   ├── parkingDetail/  # 停车场详情
│   ├── navi/           # 导航页
│   ├── mine/           # 我的
│   ├── record/          # 停车记录
│   ├── coupon/         # 优惠券
│   ├── car/            # 我的车辆
│   ├── favorite/       # 我的收藏
│   ├── help/           # 帮助与反馈
│   └── about/          # 关于我们
├── images/             # 图片资源
├── utils/              # 工具函数
└── app.js             # 应用入口
```

## 使用方法

1. 打开微信开发者工具
2. 导入项目，选择 `parking-app` 文件夹
3. 在 `project.config.json` 中修改 `appid` 为你的小程序 AppID
4. 添加必要的图片资源到 `images` 文件夹
5. 编译运行

## 需要添加的图片

在 `images` 文件夹中添加以下图片（可使用占位图）：
- `home.png` / `home-active.png` - 首页图标
- `search.png` / `search-active.png` - 搜索图标
- `user.png` / `user-active.png` - 我的图标
- `marker.png` - 地图标记
- `scan.png` - 扫码图标
- `navi.png` - 导航图标
- `record.png` - 记录图标
- `coupon.png` - 优惠券图标
- `favorite.png` - 收藏图标
- `car.png` - 车辆图标
- `help.png` - 帮助图标
- `about.png` - 关于图标
- `service.png` - 客服图标
- `logo.png` - 应用Logo
- `empty.png` - 空状态图标
- `avatar-default.png` - 默认头像
- `car.png` / `car-active.png` - 车辆图标

## 功能列表

- [x] 首页：地图展示、附近停车场列表
- [x] 找车位：搜索、筛选、排序
- [x] 停车场详情：信息展示、导航
- [x] 导航：路线规划、位置选择
- [x] 停车：扫码停车、结束停车
- [x] 我的：个人信息入口
- [x] 停车记录：历史停车列表
- [x] 优惠券：我的优惠券
- [x] 我的车辆：车辆管理
- [x] 帮助与反馈：常见问题
- [x] 关于我们：联系方式

## 注意事项

1. 这是微信原生小程序，不需要npm安装
2. 地图功能需要用户授权位置权限
3. 登录功能使用微信getUserProfile接口
4. 图片资源需要手动添加
