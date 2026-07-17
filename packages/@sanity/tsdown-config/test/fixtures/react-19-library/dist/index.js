import { c } from "react/compiler-runtime";
import "react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
const bar = /* @__PURE__ */ jsx("div", {});
function Button(t0) {
	let $ = c(4), { children, type: t1 } = t0, type = t1 === void 0 ? "button" : t1, t2;
	$[0] === Symbol.for("react.memo_cache_sentinel") ? (t2 = !1, $[0] = t2) : t2 = $[0];
	let t3;
	return $[1] !== children || $[2] !== type ? (t3 = /* @__PURE__ */ jsxs(Fragment, { children: [
		t2,
		/* @__PURE__ */ jsx("button", {
			type,
			"data-bool": !0,
			children
		}),
		bar
	] }), $[1] = children, $[2] = type, $[3] = t3) : t3 = $[3], t3;
}
/**
* Object-property components React Compiler's `infer` mode never compiles on its own — the
* `reactCompilerSurfaces` option annotates them with `'use memo'` so the compiler memoizes
* them in place.
*/
const portableTextComponents = { marks: { link: (t0) => {
	"use memo";
	let $ = c(4), { children, value } = t0, rel = value?.href.startsWith("/") ? void 0 : "noreferrer noopener", t1 = value?.href, t2;
	return $[0] !== children || $[1] !== rel || $[2] !== t1 ? (t2 = /* @__PURE__ */ jsx("a", {
		href: t1,
		rel,
		children
	}), $[0] = children, $[1] = rel, $[2] = t1, $[3] = t2) : t2 = $[3], t2;
} } };
export { Button, portableTextComponents };

//# sourceMappingURL=index.js.map