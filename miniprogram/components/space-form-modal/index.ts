/**
 * 空间表单弹层 —— 名称输入 + 类型选择 + 图标选择器
 *
 * 使用方：pages/spaces（新建根空间 / 加子空间 / 重命名）、pages/location（快捷新建）
 * 事件：
 *   confirm  detail: { name, type, icon, parentId }
 *   cancel   点击遮罩 / 取消按钮
 * 说明：
 * - icon 为空串表示"不指定"（后端存 null，前端按名称匹配兜底）；
 * - type 与所选图标联动（图标定义里携带归属类型），未选图标时 type 不提交；
 * - 打开时会用 initialName / initialType / initialIcon 预填（重命名场景）。
 */
import { ICON_CATEGORIES, SpaceIconDef, SpaceIconCategory } from '../../utils/space-icons'
import { iconPathsFromKey } from '../../utils/spaces'
import { checkName } from '../../utils/validate'
import type { SpaceType } from '../../types/api'

interface IconOption extends SpaceIconDef {
  glyph: string
  card: string
}

interface CategoryOption extends SpaceIconCategory {
  icons: IconOption[]
}

Component({
  properties: {
    visible: { type: Boolean, value: false },
    /** 弹层标题，如「添加子空间」「重命名空间」 */
    title: { type: String, value: '添加空间' },
    /** 父空间名（用于「在『书房』下添加」副标题），可为空 */
    parentName: { type: String, value: '' },
    /** 预填名称（重命名场景） */
    initialName: { type: String, value: '' },
    /** 预填类型（重命名场景） */
    initialType: { type: String, value: '' },
    /** 预填图标 key（重命名场景） */
    initialIcon: { type: String, value: '' },
    /** 提交按钮文案，默认「确定」 */
    confirmText: { type: String, value: '确定' }
  },

  data: {
    name: '',
    type: '',
    icon: '',
    categories: [] as CategoryOption[],
    activeCat: '',
    submitting: false
  },

  observers: {
    visible(v: boolean) {
      if (v) this.resetForm()
    }
  },

  lifetimes: {
    attached() {
      // 把图标注册表转成带资源路径的渲染结构（glyph 用于网格展示）
      const categories: CategoryOption[] = ICON_CATEGORIES.map(function (cat) {
        return {
          id: cat.id,
          label: cat.label,
          icons: cat.icons.map(function (def) {
            const paths = iconPathsFromKey(def.key)
            return {
              key: def.key,
              label: def.label,
              type: def.type,
              glyph: paths ? paths.glyph : '/assets/spaces/glyphs/other_space.svg',
              card: paths ? paths.card : '/assets/spaces/cards/other_space.svg'
            }
          })
        }
      })
      this.setData({ categories: categories })
    }
  },

  methods: {
    resetForm() {
      const initialIcon = this.properties.initialIcon || ''
      // 预填图标时，activeCat 定位到该图标所属分类，方便直接看到选中项
      let activeCat = ''
      for (const cat of this.data.categories) {
        if (cat.icons.some(function (i) { return i.key === initialIcon })) {
          activeCat = cat.id
          break
        }
      }
      this.setData({
        name: this.properties.initialName || '',
        type: this.properties.initialType || '',
        icon: initialIcon,
        activeCat: activeCat || (this.data.categories[0] && this.data.categories[0].id) || '',
        submitting: false
      })
    },

    onInput(e: any) {
      this.setData({ name: e.detail.value })
    },

    onCatTap(e: any) {
      const id = e.currentTarget.dataset.id
      if (!id) return
      this.setData({ activeCat: id })
    },

    onIconTap(e: any) {
      const key = e.currentTarget.dataset.key
      const type = e.currentTarget.dataset.type
      if (!key) return
      // 点选图标即联动其归属类型；再次点同一图标 = 取消选择
      if (this.data.icon === key) {
        this.setData({ icon: '', type: '' })
      } else {
        this.setData({ icon: key, type: type || '' })
      }
    },

    onCancel() {
      if (this.data.submitting) return
      this.triggerEvent('cancel')
    },

    preventBubble() {
      // 阻止点击弹层内容冒泡到遮罩关闭
    },

    preventTouchMove() {
      // 阻止底层滑动穿透
    },

    onSubmit() {
      if (this.data.submitting) return
      const name = (this.data.name || '').trim()
      if (!name) {
        wx.showToast({ title: '空间名称不能为空', icon: 'none' })
        return
      }
      const lenErr = checkName(name, '空间名称')
      if (lenErr) {
        wx.showToast({ title: lenErr, icon: 'none' })
        return
      }
      this.setData({ submitting: true })
      this.triggerEvent('confirm', {
        name: name,
        type: (this.data.type as SpaceType) || undefined,
        icon: this.data.icon || null
      })
    }
  }
})