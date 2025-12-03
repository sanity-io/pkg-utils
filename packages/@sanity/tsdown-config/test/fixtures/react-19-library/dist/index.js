import { Fragment, jsx, jsxs } from "react/jsx-runtime";

const bool = true;
const bar = /* @__PURE__ */ jsx("div", {});
function Button({ children, type = "button" }) {
	return /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx("button", {
		type,
		"data-bool": bool,
		children
	}), bar] });
}

export { Button };
//# sourceMappingURL=index.js.map