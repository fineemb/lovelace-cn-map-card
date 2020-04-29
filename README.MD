<!--
 * @Author        : fineemb
 * @Github        : https://github.com/fineemb
 * @Description   : 
 * @Date          : 2020-02-16 22:33:53
 * @LastEditors   : fineemb
 * @LastEditTime  : 2020-04-29 18:32:12
 -->

# Lovelace DC1 Card

[![hacs_badge](https://img.shields.io/badge/HACS-Default-orange.svg)](https://github.com/custom-components/hacs)

这个是一个基于高德地图API的Lovelace卡片,完全复刻的官方地图卡片,几乎包含了原来卡片的所有功能. 未来可能会支持更多新的技能.

+ 完全复刻官方的卡片
+ 支持前台自定义卡片配置.

## 预览
![](https://iobroker-1255708240.cos.ap-hongkong.myqcloud.com/original/2X/6/67bd320a6d0f3f7442c94df865d0dfafdb506291.png)
![](https://iobroker-1255708240.cos.ap-hongkong.myqcloud.com/original/2X/c/c38c535b7e5573e12f2f1c2a4746ea5875d4e202.png)

## HACS 安装
搜索Gaode Map card, 或者手动添加地址安装
## 手动安装
1. 下载 `cn-map-card.js`
1. 复制到 `www\community\lovelace-cn-map`
1. 在Lovelace的resources下添加以下配置
    ``` yaml
    resources:
      - url: /local/community/lovelace-cn-map/cn-map-card.js
        type: js
    ```
1. 在Lovelace视图 `views.cards` 内部添加卡片配置
    ```yaml
      type: 'custom:cn-map-card'
      default_zoom: '9'
      dark_mode: false
      hours_to_show: '168'
      entities:
        - entity: person.a
        - entity: person.b
        - entity: person.c
        - entity: zone.school
        - entity: zone.home
      key: f87e0c9c4f3e1e78f963075d142979f0
      title: Map
    ```

## 选项

| 属性名 | 类型 | 默认 | 描述
| ---- | ---- | ------- | -----------
| title | string | 选项 | 卡片标题
| entities | entity id | **必选** | 需要显示的条目,支持person,zone,device_tracker
| default_zoom | Number | 选项 | 地图默认缩放等级
| dark_mode | boolean | 选项 | 地图夜间黑暗模式开关
| hours_to_show | Number | 选项 | 指定时间内的历史路径,这里是填的是小时
| key | string | **必选** | 自己去高德申请key,内置的key说不定哪天就失效了.




