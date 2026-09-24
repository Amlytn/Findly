/**
 * 小程序全局 API 的轻量类型声明
 * （未安装官方 miniprogram-api-typings，此处保证 TS 编译与编辑器不报红）
 *
 * 为什么 Page/Component 要写成泛型 + ThisType：
 * 声明成 (options: any) 时，方法里的 this 没有上下文可用，开启 noImplicitThis 后
 * 会被推断成"那个对象字面量本身"，于是 this.data / this.setData 全线报 TS2339
 * （本项目曾一次性报出 55 个）。ThisType 把框架注入的成员并回 this 即可修正。
 *
 * 已知天花板：`wx` 仍是 any，所以打开 strict 不会给 API 调用层带来类型保护，
 * 真正的收益在 strictNullChecks / noImplicitAny 命中的自有模块（utils/、services/）。
 */
declare const wx: any

/** 框架注入到页面与组件实例上的公共成员 */
interface WxInstance {
  data: any;
  setData(data: Record<string, any>, callback?: () => void): void;
  createSelectorQuery(): any;
  animate(selector: string, animation: any, options: any, callback?: () => void): void;
}

/** 组件比页面多出的成员：properties 由框架按定义注入，triggerEvent 用于向父级派发事件 */
interface WxComponentInstance extends WxInstance {
  properties: any;
  triggerEvent(name: string, detail?: any, options?: Record<string, any>): void;
}

/**
 * 组件的成员方法挂在 methods 键下，不在选项对象的顶层，
 * 因此 this 必须并上 methods 的内容——否则 methods 之间互相调用（this.resetForm()）会报错。
 * observers / lifetimes 同理，它们的 this 与 methods 同一实例。
 */
type ComponentThis<T> = T extends { methods: infer M } ? M & WxComponentInstance : WxComponentInstance;

declare function App<T>(options: T & ThisType<T & WxInstance>): void
declare function Page<T>(options: T & ThisType<T & WxInstance>): void
declare function Component<T>(options: T & ThisType<ComponentThis<T>>): void
declare function Behavior<T>(options: T & ThisType<ComponentThis<T>>): void
declare function getApp<T = any>(): T
declare function getCurrentPages(): any[]
