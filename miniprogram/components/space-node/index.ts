/**
 * 空间节点（空间管理 2.0）：根卡片与子空间行同构，点击就地展开/收起（逐节点独立，
 * 收起只影响自己及内部），展开渲染「物品货架 + 子空间行」双模块，子行经自引用递归逐层展开。
 * 长按 = 同级拖动排序（拖拽编排由页面负责，组件只转发触点事件与渲染插入指示线）。
 * 全部事件 bubbles+composed 上抛给 spaces 页统一处理（组件自身无状态、无请求）。
 */
Component({
  properties: {
    node: {
      type: Object,
      value: null
    },
    itemsMap: {
      type: Object,
      value: {}
    },
    loadingMap: {
      type: Object,
      value: {}
    },
    /** 拖拽状态 { dragId, parentId, index } | null：index = 插入位（0 基，含末尾） */
    drag: {
      type: Object,
      value: null
    },
    /** 搜索回跳高亮的物品 id */
    highlightId: {
      type: String,
      value: ''
    },
    /** 新建后需获焦滚动的子空间 id（本组件仅处理自己 children 内的目标） */
    focusId: {
      type: String,
      value: ''
    }
  },

  observers: {
    /** 回跳高亮：目标物品在自己的货架里时，把它滚进视野 */
    highlightId: function (id: string) {
      if (!id || !this.data.node) return
      const items = this.data.itemsMap && this.data.itemsMap[this.data.node.id]
      if (!items || !items.length) return
      let mine = false
      for (const it of items) {
        if (it.id === id) { mine = true; break }
      }
      if (!mine) return
      const that = this
      setTimeout(function () {
        that.createSelectorQuery()
          .select('#item-' + id)
          .boundingClientRect()
          .selectViewport()
          .scrollOffset()
          .exec(function (res: any) {
            const rect = res && res[0]
            const scroll = res && res[1]
            if (!rect) return
            const top = rect.top + ((scroll && scroll.scrollTop) || 0) - 180
            wx.pageScrollTo({ scrollTop: Math.max(0, top), duration: 300 })
          })
      }, 150)
    },

    /** 新建获焦：目标是自己 children 里的新空间时滚到它 */
    focusId: function (id: string) {
      if (!id || !this.data.node) return
      const children = this.data.node.children || []
      let mine = false
      for (const c of children) {
        if (c.id === id) { mine = true; break }
      }
      if (!mine) return
      const that = this
      setTimeout(function () {
        that.createSelectorQuery()
          .select('#space-' + id)
          .boundingClientRect()
          .selectViewport()
          .scrollOffset()
          .exec(function (res: any) {
            const rect = res && res[0]
            const scroll = res && res[1]
            if (!rect) return
            const top = rect.top + ((scroll && scroll.scrollTop) || 0) - 160
            wx.pageScrollTo({ scrollTop: Math.max(0, top), duration: 300 })
          })
      }, 150)
    }
  },

  methods: {
    /** 展开体空白处 catchtap 占位：点模块内部不误触发收起 */
    noop() {},

    /** 点卡片/行：就地展开/收起（逐节点独立） */
    onTap() {
      if (!this.data.node) return
      this.triggerEvent('toggle', { item: this.data.node }, { bubbles: true, composed: true })
    },

    /** 「⋯」：空间管理菜单（编辑 / 移动到 / 删除） */
    onMore() {
      if (!this.data.node) return
      this.triggerEvent('moreaction', { item: this.data.node }, { bubbles: true, composed: true })
    },

    /** 长按：进入同级拖动排序（携带自身卡高，页面据此估算步进） */
    onDragStart() {
      if (!this.data.node) return
      const that = this
      this.createSelectorQuery()
        .select('.sp-card')
        .boundingClientRect()
        .exec(function (res: any) {
          const rect = res && res[0]
          that.triggerEvent(
            'dragstart',
            { item: that.data.node, height: rect && rect.height ? rect.height : 60, top: rect && rect.top ? rect.top : 0 },
            { bubbles: true, composed: true }
          )
        })
    },

    onDragMove(e: any) {
      const t = e.touches && e.touches[0]
      if (!t) return
      this.triggerEvent('dragmove', { clientY: t.clientY, pageY: t.pageY }, { bubbles: true, composed: true })
    },

    onDragEnd() {
      if (!this.data.node) return
      this.triggerEvent('dragend', { item: this.data.node }, { bubbles: true, composed: true })
    },

    /** 物品模块「＋ 添加物品」 */
    onAddItem() {
      if (!this.data.node) return
      this.triggerEvent('additem', { item: this.data.node }, { bubbles: true, composed: true })
    },

    /** 空间模块「＋ 添加空间」（含空态虚线卡） */
    onAddSpace() {
      if (!this.data.node) return
      this.triggerEvent('addspace', { item: this.data.node }, { bubbles: true, composed: true })
    },

    /** 货架缩略瓦片：物品详情（具体物品 id 由 dataset 携带） */
    onTileTap(e: any) {
      const id = e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.id
      if (!id) return
      this.triggerEvent('itemdetail', { id: id }, { bubbles: true, composed: true })
    },

    /** 货架「···」：进入该空间的完整物品列表 */
    onShowAll() {
      if (!this.data.node) return
      this.triggerEvent('showall', { item: this.data.node }, { bubbles: true, composed: true })
    }
  }
})
