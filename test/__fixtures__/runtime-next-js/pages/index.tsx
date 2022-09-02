import * as index from "exports-dummy";
import * as extra from "exports-dummy/extra";

console.log({ index, extra });

export default function IndexPage() {
  return <div>IndexPage</div>;
}
