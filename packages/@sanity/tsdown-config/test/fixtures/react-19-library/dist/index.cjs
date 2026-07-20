Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
let react_compiler_runtime = require("react/compiler-runtime");
require("react");
let react_jsx_runtime = require("react/jsx-runtime");
const bar = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {});
function Button(t0) {
	let $ = (0, react_compiler_runtime.c)(4), { children, type: t1 } = t0, type = t1 === void 0 ? "button" : t1, t2;
	$[0] === Symbol.for("react.memo_cache_sentinel") ? (t2 = !1, $[0] = t2) : t2 = $[0];
	let t3;
	return $[1] !== children || $[2] !== type ? (t3 = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
		t2,
		/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
			type,
			"data-bool": !0,
			children
		}),
		bar
	] }), $[1] = children, $[2] = type, $[3] = t3) : t3 = $[3], t3;
}
/**
* Object-property components React Compiler's `infer` mode never compiles on its own — the
* `@sanity/react-compiler-rolldown-plugin` pre-pass annotates them with `'use memo'` so the
* compiler memoizes them in place.
*/
const portableTextComponents = { marks: { link: (t0) => {
	"use memo";
	let $ = (0, react_compiler_runtime.c)(4), { children, value } = t0, rel = value?.href.startsWith("/") ? void 0 : "noreferrer noopener", t1 = value?.href, t2;
	return $[0] !== children || $[1] !== rel || $[2] !== t1 ? (t2 = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
		href: t1,
		rel,
		children
	}), $[0] = children, $[1] = rel, $[2] = t1, $[3] = t2) : t2 = $[3], t2;
} } };
exports.Button = Button, exports.portableTextComponents = portableTextComponents;

//# sourceMappingURL=index.cjs.map