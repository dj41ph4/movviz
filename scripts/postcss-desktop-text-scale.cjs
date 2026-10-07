const scope = 'html:is([data-desktop-text-scale="110"], [data-desktop-text-scale="120"])';

/** Font-only overrides retain cascade layers, responsive conditions and nesting.
 * Originals are untouched; 100% never matches these selectors. */
module.exports = () => ({
  postcssPlugin: 'movviz-desktop-text-scale',
  OnceExit(root, { postcss }) {
    function typography(node) {
      if (node.type === 'decl') {
        if (node.prop === 'font-size' && !/^(inherit|initial|unset|revert|revert-layer|[\d.]+%)$/.test(node.value)) {
          return node.clone({ value: `calc(${node.value} * var(--mv-desktop-text-factor))` });
        }
        if (node.prop === 'font') {
          const size = node.value.match(/(?:^|\s)([\d.]+(?:px|rem|em))(?:\/[^\s]+)?(?:\s|$)/)?.[1];
          if (size) return postcss.decl({ prop: 'font-size', value: `calc(${size} * var(--mv-desktop-text-factor))`, important: node.important });
        }
        if (node.prop === 'line-height' && /^[\d.]+(?:px|rem|em)$/.test(node.value)) {
          return node.clone({ value: `calc(${node.value} * var(--mv-desktop-text-factor))` });
        }
        return null;
      }
      if (!node.nodes) return null;
      const children = node.nodes.map(typography).filter(Boolean);
      return children.length ? node.clone({ nodes: children }) : null;
    }
    const originals = [];
    root.walkRules(rule => {
      if (rule.selector.includes('data-desktop-text-scale')) return;
      for (let parent = rule.parent; parent; parent = parent.parent) {
        if (parent.type === 'rule' || (parent.type === 'atrule' && /keyframes$/i.test(parent.name))) return;
      }
      const enlarged = typography(rule);
      if (enlarged) originals.push({ rule, enlarged });
    });
    for (const { rule, enlarged } of originals) {
      enlarged.selector = rule.selectors.map(selector => {
        if (/^html(?=[\s.#[:]|$)/.test(selector)) return selector.replace(/^html/, scope);
        if (/^:root(?=[\s.#[:]|$)/.test(selector)) return selector.replace(/^:root/, scope);
        return `${scope} ${selector}`;
      }).join(', ');
      const media = postcss.atRule({ name: 'media', params: '(min-width: 1024px)' });
      media.append(enlarged);
      rule.after(media);
    }
  },
});
module.exports.postcss = true;
