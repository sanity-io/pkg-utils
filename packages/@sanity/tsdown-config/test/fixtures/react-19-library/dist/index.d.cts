import { ComponentType, ReactNode } from "react";
declare function Button({ children, type }: {
  children: React.ReactNode;
  type?: "submit" | "button" | "reset";
}): React.JSX.Element;
/**
 * Any object with an `_type` property (which is required in portable text arrays),
 * as well as a _potential_ `_key` (highly encouraged)
 * @public
 */
interface TypedObject {
  /**
   * Identifies the type of object/span this is, and is used to pick the correct React components
   * to use when rendering a span or inline object with this type.
   */
  _type: string;
  /**
   * Uniquely identifies this object within its parent block.
   * Not _required_, but highly encouraged.
   */
  _key?: string;
}
/**
 * Any object with an `_type` that is a string. Can hold any other properties.
 * @public
 */
type ArbitraryTypedObject = TypedObject & {
  [key: string]: any;
};
/**
 * A Portable Text Block can be thought of as one paragraph, quote or list item.
 * In other words, it is a container for text, that can have a visual style associated with it.
 * The actual text value is stored in portable text spans inside of the `childen` array.
 *
 * @typeParam M - Mark types that be used for text spans
 * @typeParam C - Types allowed as children of this block
 * @typeParam S - Allowed block styles (eg `normal`, `blockquote`, `h3` etc)
 * @typeParam L - Allowed list item types (eg `number`, `bullet` etc)
 * @public
 */
interface PortableTextBlock<M extends PortableTextMarkDefinition = PortableTextMarkDefinition, C extends TypedObject = ArbitraryTypedObject | PortableTextSpan, S extends string = PortableTextBlockStyle, L extends string = PortableTextListItemType> extends TypedObject {
  /**
   * Type name identifying this as a portable text block.
   * All items within a portable text array should have a `_type` property.
   *
   * Usually 'block', but can be customized to other values
   */
  _type: "block" | (string & {});
  /**
   * A key that identifies this block uniquely within the parent array. Used to more easily address
   * the block when editing collaboratively, but is also very useful for keys inside of React and
   * other rendering frameworks that can use keys to optimize operations.
   */
  _key?: string;
  /**
   * Array of inline items for this block. Usually contain text spans, but can be
   * configured to include inline objects of other types as well.
   */
  children: C[];
  /**
   * Array of mark definitions used in child text spans. By having them be on the block level,
   * the same mark definition can be reused for multiple text spans, which is often the case
   * with nested marks.
   */
  markDefs?: M[];
  /**
   * Visual style of the block
   * Common values: 'normal', 'blockquote', 'h1'...'h6'
   */
  style?: S;
  /**
   * If this block is a list item, identifies which style of list item this is
   * Common values: 'bullet', 'number', but can be configured
   */
  listItem?: L;
  /**
   * If this block is a list item, identifies which level of nesting it belongs within
   */
  level?: number;
}
/**
 * Strictly speaking the same as a portable text block, but `listItem` is required
 *
 * @typeParam M - Mark types that be used for text spans
 * @typeParam C - Types allowed as children of this block
 * @typeParam S - Allowed block styles (eg `normal`, `blockquote`, `h3` etc)
 * @typeParam L - Allowed list item types (eg `number`, `bullet` etc)
 * @public
 */
interface PortableTextListItemBlock<M extends PortableTextMarkDefinition = PortableTextMarkDefinition, C extends TypedObject = PortableTextSpan, S extends string = PortableTextBlockStyle, L extends string = PortableTextListItemType> extends Omit<PortableTextBlock<M, C, S, L>, "listItem"> {
  listItem: L;
}
/**
 * A set of _common_ (but not required/standarized) block styles
 * @public
 */
type PortableTextBlockStyle = "normal" | "blockquote" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | (string & {});
/**
 * A set of _common_ (but not required/standardized) list item types
 * @public
 */
type PortableTextListItemType = "bullet" | "number" | (string & {});
/**
 * A mark definition holds information for marked text. For instance, a text span could reference
 * a mark definition for a hyperlink, a geoposition, a reference to a document or anything that is
 * representable as a JSON object.
 * @public
 */
interface PortableTextMarkDefinition {
  /**
   * Unknown properties
   */
  [key: string]: unknown;
  /**
   * Identifies the type of mark this is, and is used to pick the correct React components to use
   * when rendering a text span marked with this mark type.
   */
  _type: string;
  /**
   * Uniquely identifies this mark definition within the block
   */
  _key: string;
}
/**
 * A Portable Text Span holds a chunk of the actual text value of a Portable Text Block
 * @public
 */
interface PortableTextSpan {
  /**
   * Type is always `span` for portable text spans, as these don't vary in shape
   */
  _type: "span";
  /**
   * Unique (within parent block) key for this portable text span
   */
  _key?: string;
  /**
   * The actual text value of this text span
   */
  text: string;
  /**
   * An array of marks this text span is annotated with, identified by its `_key`.
   * If the key cannot be found in the parent blocks mark definition, the mark is assumed to be a
   * decorator (a simpler mark without any properties - for instance `strong` or `em`)
   */
  marks?: string[];
}
/**
 * Toolkit-specific type representing a nested list
 *
 * See the `nestLists()` function for more info
 */
type ToolkitPortableTextList = ToolkitPortableTextHtmlList | ToolkitPortableTextDirectList;
/**
 * Toolkit-specific type representing a nested list in HTML mode, where deeper lists are nested
 * inside of the _list items_, eg `<ul><li>Some text<ul><li>Deeper</li></ul></li></ul>`
 */
interface ToolkitPortableTextHtmlList {
  /**
   * Type name, prefixed with `@` to signal that this is a toolkit-specific node.
   */
  _type: "@list";
  /**
   * Unique key for this list (within its parent)
   */
  _key: string;
  /**
   * List mode, signaling that list nodes will appear as children of the _list items_
   */
  mode: "html";
  /**
   * Level/depth of this list node (starts at `1`)
   */
  level: number;
  /**
   * Style of this list item (`bullet`, `number` are common values, but can be customized)
   */
  listItem: string;
  /**
   * Child nodes of this list - toolkit-specific list items which can themselves hold deeper lists
   */
  children: ToolkitPortableTextListItem[];
}
/**
 * Toolkit-specific type representing a nested list in "direct" mode, where deeper lists are nested
 * inside of the lists children, alongside other blocks.
 */
interface ToolkitPortableTextDirectList {
  /**
   * Type name, prefixed with `@` to signal that this is a toolkit-specific node.
   */
  _type: "@list";
  /**
   * Unique key for this list (within its parent)
   */
  _key: string;
  /**
   * List mode, signaling that list nodes can appear as direct children
   */
  mode: "direct";
  /**
   * Level/depth of this list node (starts at `1`)
   */
  level: number;
  /**
   * Style of this list item (`bullet`, `number` are common values, but can be customized)
   */
  listItem: string;
  /**
   * Child nodes of this list - either portable text list items, or another, deeper list
   */
  children: (PortableTextListItemBlock | ToolkitPortableTextDirectList)[];
}
/**
 * Toolkit-specific type representing a list item block, but where the children can be another list
 */
interface ToolkitPortableTextListItem extends PortableTextListItemBlock<PortableTextMarkDefinition, PortableTextSpan | ToolkitPortableTextList> {}
/**
 * Generic type for portable text rendering components that takes blocks/inline blocks
 *
 * @template N Node types we expect to be rendering (`PortableTextBlock` should usually be part of this)
 */
type PortableTextComponent<N> = ComponentType<PortableTextComponentProps<N>>;
/**
 * React component type for rendering portable text blocks (paragraphs, headings, blockquotes etc)
 */
type PortableTextBlockComponent = PortableTextComponent<PortableTextBlock>;
/**
 * React component type for rendering (virtual, not part of the spec) portable text lists
 */
type PortableTextListComponent = PortableTextComponent<ReactPortableTextList>;
/**
 * React component type for rendering portable text list items
 */
type PortableTextListItemComponent = PortableTextComponent<PortableTextListItemBlock>;
/**
 * React component type for rendering portable text marks and/or decorators
 *
 * @template M The mark type we expect
 */
type PortableTextMarkComponent<M extends TypedObject = any> = ComponentType<PortableTextMarkComponentProps<M>>;
type PortableTextTypeComponent<V extends TypedObject = any> = ComponentType<PortableTextTypeComponentProps<V>>;
type LooseRecord<K extends string, V> = Record<string, V> & { [P in K]?: V; };
type TypeName<T> = T extends {
  _type: infer Name;
} ? (Name extends string ? Name : never) : never;
type CustomPortableTextType<B extends TypedObject> = Exclude<B, {
  _type: "block";
}>;
type CustomPortableTextTypeName<B extends TypedObject> = TypeName<CustomPortableTextType<B>>;
type PortableTextBlockType<B extends TypedObject> = Extract<B, {
  _type: "block";
}>;
type PortableTextBlockStyleName<B extends TypedObject> = PortableTextBlockType<B> extends {
  style?: infer Style;
} ? NonNullable<Style> extends string ? NonNullable<Style> : never : never;
type PortableTextBlockForStyle<B extends TypedObject, Style extends string> = PortableTextBlockType<B> extends (infer Block) ? Block extends TypedObject ? Omit<Block, "style"> & {
  style?: Extract<Block extends {
    style?: infer S;
  } ? S : never, Style>;
} : never : never;
type PortableTextBlockComponentFor<B extends TypedObject> = PortableTextBlockType<B> extends never ? PortableTextBlockComponent : PortableTextComponent<PortableTextBlockType<B>>;
type PortableTextBlockComponents<B extends TypedObject> = string extends PortableTextBlockStyleName<B> ? LooseRecord<PortableTextBlockStyle, PortableTextBlockComponent | undefined> : PortableTextBlockStyleName<B> extends never ? LooseRecord<PortableTextBlockStyle, PortableTextBlockComponent | undefined> : Record<string, PortableTextComponent<any> | undefined> & { [Style in PortableTextBlockStyleName<B>]?: PortableTextComponent<PortableTextBlockForStyle<B, Style>>; };
type PortableTextListItemName<B extends TypedObject> = PortableTextBlockType<B> extends {
  listItem?: infer ListItem;
} ? NonNullable<ListItem> extends string ? NonNullable<ListItem> : never : never;
type PortableTextListForItem<ListItem extends string> = ReactPortableTextList extends (infer List) ? List extends ReactPortableTextList ? Omit<List, "listItem"> & {
  listItem: ListItem;
} : never : never;
type PortableTextBlockForListItem<B extends TypedObject, ListItem extends string> = PortableTextBlockType<B> extends (infer Block) ? Block extends TypedObject ? Omit<Block, "listItem"> & {
  listItem: Extract<Block extends {
    listItem?: infer Item;
  } ? Item : never, ListItem>;
} : never : never;
type PortableTextListComponentFor<B extends TypedObject> = PortableTextListItemName<B> extends never ? PortableTextListComponent : PortableTextComponent<PortableTextListForItem<PortableTextListItemName<B>>>;
type PortableTextListItemComponentFor<B extends TypedObject> = PortableTextListItemName<B> extends never ? PortableTextListItemComponent : PortableTextComponent<PortableTextBlockForListItem<B, PortableTextListItemName<B>>>;
type PortableTextListComponents<B extends TypedObject> = string extends PortableTextListItemName<B> ? LooseRecord<PortableTextListItemType, PortableTextListComponent | undefined> : PortableTextListItemName<B> extends never ? Record<string, PortableTextComponent<any> | undefined> : Record<string, PortableTextComponent<any> | undefined> & { [ListItem in PortableTextListItemName<B>]?: PortableTextComponent<PortableTextListForItem<ListItem>>; };
type PortableTextListItemComponents<B extends TypedObject> = string extends PortableTextListItemName<B> ? LooseRecord<PortableTextListItemType, PortableTextListItemComponent | undefined> : PortableTextListItemName<B> extends never ? Record<string, PortableTextComponent<any> | undefined> : Record<string, PortableTextComponent<any> | undefined> & { [ListItem in PortableTextListItemName<B>]?: PortableTextComponent<PortableTextBlockForListItem<B, ListItem>>; };
type PortableTextMarkType<B extends TypedObject> = PortableTextBlockType<B> extends {
  markDefs?: infer MarkDefs;
} ? NonNullable<MarkDefs> extends readonly (infer MarkDef)[] ? Extract<MarkDef, TypedObject> : never : never;
type PortableTextMarkTypeName<B extends TypedObject> = TypeName<PortableTextMarkType<B>>;
type PortableTextMarkComponents<B extends TypedObject> = string extends PortableTextMarkTypeName<B> ? Record<string, PortableTextMarkComponent | undefined> : PortableTextMarkTypeName<B> extends never ? Record<string, PortableTextMarkComponent | undefined> : Record<string, PortableTextMarkComponent | undefined> & { [Type in PortableTextMarkTypeName<B>]?: PortableTextMarkComponent<Extract<PortableTextMarkType<B>, {
  _type: Type;
}>>; };
type PortableTextTypeComponents<B extends TypedObject> = string extends CustomPortableTextTypeName<B> ? Record<string, PortableTextTypeComponent | undefined> : CustomPortableTextTypeName<B> extends never ? Record<string, PortableTextTypeComponent | undefined> : Record<string, PortableTextTypeComponent | undefined> & { [Type in CustomPortableTextTypeName<B>]?: PortableTextTypeComponent<Extract<CustomPortableTextType<B>, {
  _type: Type;
}>>; };
/**
 * Object defining the different React components to use for rendering various aspects
 * of Portable Text and user-provided types, where only the overrides needs to be provided.
 */
type PortableTextComponents<B extends TypedObject = any> = Partial<PortableTextReactComponents<B>>;
/**
 * Object definining the different React components to use for rendering various aspects
 * of Portable Text and user-provided types.
 */
interface PortableTextReactComponents<B extends TypedObject = any> {
  /**
   * Object of React components that renders different types of objects that might appear
   * both as part of the blocks array, or as inline objects _inside_ of a block,
   * alongside text spans.
   *
   * Use the `isInline` property to check whether or not this is an inline object or a block
   *
   * The object has the shape `{typeName: ReactComponent}`, where `typeName` is the value set
   * in individual `_type` attributes.
   */
  types: PortableTextTypeComponents<B>;
  /**
   * Object of React components that renders different types of marks that might appear in spans.
   *
   * The object has the shape `{markName: ReactComponent}`, where `markName` is the value set
   * in individual `_type` attributes, values being stored in the parent blocks `markDefs`.
   */
  marks: PortableTextMarkComponents<B>;
  /**
   * Object of React components that renders blocks with different `style` properties.
   *
   * The object has the shape `{styleName: ReactComponent}`, where `styleName` is the value set
   * in individual `style` attributes on blocks.
   *
   * Can also be set to a single React component, which would handle block styles of _any_ type.
   */
  block: PortableTextBlockComponents<B> | PortableTextBlockComponentFor<B>;
  /**
   * Object of React components used to render lists of different types (bulleted vs numbered,
   * for instance, which by default is `<ul>` and `<ol>`, respectively)
   *
   * There is no actual "list" node type in the Portable Text specification, but a series of
   * list item blocks with the same `level` and `listItem` properties will be grouped into a
   * virtual one inside of this library.
   *
   * Can also be set to a single React component, which would handle lists of _any_ type.
   */
  list: PortableTextListComponents<B> | PortableTextListComponentFor<B>;
  /**
   * Object of React components used to render different list item styles.
   *
   * The object has the shape `{listItemType: ReactComponent}`, where `listItemType` is the value
   * set in individual `listItem` attributes on blocks.
   *
   * Can also be set to a single React component, which would handle list items of _any_ type.
   */
  listItem: PortableTextListItemComponents<B> | PortableTextListItemComponentFor<B>;
  /**
   * Component to use for rendering "hard breaks", eg `\n` inside of text spans
   * Will by default render a `<br />`. Pass `false` to render as-is (`\n`)
   */
  hardBreak: ComponentType | false;
  /**
   * React component used when encountering a mark type there is no registered component for
   * in the `components.marks` prop.
   */
  unknownMark: PortableTextMarkComponent;
  /**
   * React component used when encountering an object type there is no registered component for
   * in the `components.types` prop.
   */
  unknownType: PortableTextComponent<UnknownNodeType>;
  /**
   * React component used when encountering a block style there is no registered component for
   * in the `components.block` prop. Only used if `components.block` is an object.
   */
  unknownBlockStyle: PortableTextComponent<PortableTextBlock>;
  /**
   * React component used when encountering a list style there is no registered component for
   * in the `components.list` prop. Only used if `components.list` is an object.
   */
  unknownList: PortableTextComponent<ReactPortableTextList>;
  /**
   * React component used when encountering a list item style there is no registered component for
   * in the `components.listItem` prop. Only used if `components.listItem` is an object.
   */
  unknownListItem: PortableTextComponent<PortableTextListItemBlock>;
}
/**
 * Props received by most Portable Text components
 *
 * @template T Type of data this component will receive in its `value` property
 */
interface PortableTextComponentProps<T> {
  /**
   * Data associated with this portable text node, eg the raw JSON value of a block/type
   */
  value: T;
  /**
   * Index within its parent
   */
  index: number;
  /**
   * Whether or not this node is "inline" - ie as a child of a text block,
   * alongside text spans, or a block in and of itself.
   */
  isInline: boolean;
  /**
   * React child nodes of this block/component
   */
  children?: ReactNode;
  /**
   * Function used to render any node that might appear in a portable text array or block,
   * including virtual "toolkit"-nodes like lists and nested spans. You will rarely need
   * to use this.
   */
  renderNode: NodeRenderer;
}
/**
 * Props received by any user-defined type in the input array that is not a text block
 *
 * @template T Type of data this component will receive in its `value` property
 */
type PortableTextTypeComponentProps<T> = Omit<PortableTextComponentProps<T>, "children">;
/**
 * Props received by Portable Text mark rendering components
 *
 * @template M Shape describing the data associated with this mark, if it is an annotation
 */
interface PortableTextMarkComponentProps<M extends TypedObject = ArbitraryTypedObject> {
  /**
   * Mark definition, eg the actual data of the annotation. If the mark is a simple decorator, this will be `undefined`
   */
  value?: M;
  /**
   * Text content of this mark
   */
  text: string;
  /**
   * Key for this mark. The same key can be used amongst multiple text spans within the same block, so don't rely on this for React keys.
   */
  markKey?: string;
  /**
   * Type of mark - ie value of `_type` in the case of annotations, or the name of the decorator otherwise - eg `em`, `italic`.
   */
  markType: string;
  /**
   * React child nodes of this mark
   */
  children: ReactNode;
  /**
   * Function used to render any node that might appear in a portable text array or block,
   * including virtual "toolkit"-nodes like lists and nested spans. You will rarely need
   * to use this.
   */
  renderNode: NodeRenderer;
}
/**
 * Any node type that we can't identify - eg it has an `_type`,
 * but we don't know anything about its other properties
 */
type UnknownNodeType = {
  _type: string;
  [key: string]: unknown;
} | TypedObject;
/**
 * Function that renders any node that might appear in a portable text array or block,
 * including virtual "toolkit"-nodes like lists and nested spans
 */
type NodeRenderer = <T extends TypedObject>(options: Serializable<T>) => ReactNode;
interface Serializable<T> {
  node: T;
  index: number;
  isInline: boolean;
  renderNode: NodeRenderer;
}
/**
 * A virtual "list" node for Portable Text - not strictly part of Portable Text,
 * but generated by this library to ease the rendering of lists in HTML etc
 */
type ReactPortableTextList = ToolkitPortableTextList;
/**
 * Object-property components React Compiler's `infer` mode never compiles on its own — the
 * `reactCompilerSurfaces` option annotates them with `'use memo'` so the compiler memoizes
 * them in place.
 */
declare const portableTextComponents: PortableTextComponents;
export { Button, portableTextComponents };
//# sourceMappingURL=index.d.cts.map