import { LibraryManager } from "@whir/arsenal";

// 加载默认组件库
LibraryManager.loadDefaultLibrarys();

// {{#librarys}}
LibraryManager.addLibrary(require('{{{path}}}').default);
// {{/librarys}}
