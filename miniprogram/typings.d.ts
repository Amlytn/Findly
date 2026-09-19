/**
 * 小程序全局 API 的轻量类型声明
 * （未安装官方 miniprogram-api-typings，此处保证 TS 编译与编辑器不报红）
 */
declare const wx: any

declare function App(options: any): void
declare function Page(options: any): void
declare function Component(options: any): void
declare function Behavior(options: any): any
declare function getApp<T = any>(): T
declare function getCurrentPages(): any[]
