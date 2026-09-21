Component({
  properties: {
    node: {
      type: Object,
      value: null
    },
    expandedMap: {
      type: Object,
      value: {}
    },
    itemsMap: {
      type: Object,
      value: {}
    },
    itemsCountMap: {
      type: Object,
      value: {}
    },
    loadingMap: {
      type: Object,
      value: {}
    }
  },

  methods: {
    onTapCard() {
      if (!this.data.node) return
      this.triggerEvent('tapcard', { item: this.data.node }, { bubbles: true, composed: true })
    },

    onRename() {
      if (!this.data.node) return
      this.triggerEvent('rename', { item: this.data.node }, { bubbles: true, composed: true })
    },

    onAddChild() {
      if (!this.data.node) return
      this.triggerEvent('addchild', { item: this.data.node }, { bubbles: true, composed: true })
    },

    onAddItem() {
      if (!this.data.node) return
      this.triggerEvent('additem', { item: this.data.node }, { bubbles: true, composed: true })
    },

    onDelete() {
      if (!this.data.node) return
      this.triggerEvent('deletespace', { item: this.data.node }, { bubbles: true, composed: true })
    },

    onMoreTap() {
      if (!this.data.node) return
      this.triggerEvent('moreaction', { item: this.data.node }, { bubbles: true, composed: true })
    },

    onLongPress() {
      if (!this.data.node) return
      this.triggerEvent('moreaction', { item: this.data.node }, { bubbles: true, composed: true })
      this.triggerEvent('cardlongpress', { item: this.data.node }, { bubbles: true, composed: true })
    },

    onItemDetail(e: any) {
      const id = e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.id
      if (!id) return
      this.triggerEvent('itemdetail', { id }, { bubbles: true, composed: true })
    }
  }
})
