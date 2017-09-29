import {isPlainObject} from "lodash";

export default function normalizeValue(value) {
  if (value != null) {
    const type = typeof value;
    if (type === "object") {
      if (!isPlainObject(value)) value = value.toJSON();
    } else if (type === "function") {
      const fn = value;
      value = fn.toString();

      if (fn.name) {
        let args = [];
        for (let i = 0; i < fn.length; i++) {
          args.push(`_a${i}`);
        }

        value = `function(${args.join(", ")}) {\nreturn (${value}).apply(this, arguments);\n}`;
      }
    } else if (!~["string","number","boolean"].indexOf(type)) {
      value = value.toString();
    }
  }

  return value;
}
