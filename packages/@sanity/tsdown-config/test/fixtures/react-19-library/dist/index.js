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
export { Button };

//# sourceMappingURL=index.js.map