import { EnvironmentManager } from '@asany/arsenal';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/es/locale/zh_CN';
import React from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { PersistGate } from 'redux-persist/integration/react';

import { getDvaApp } from '../core/umiExports';
import auth from './models/auth';
import global from './models/global';

interface ExtDvaContainerProps {
  children: any;
}

class ExtDvaContainer extends React.Component<ExtDvaContainerProps> {
  private store: any;
  constructor(props: ExtDvaContainerProps) {
    super(props);
    const dvaApp = getDvaApp();
    // 添加插件默认支持的 Model
    dvaApp.model(auth);
    dvaApp.model(global);
    this.store = dvaApp._store;
    // 转移系统环境变量到 EnvironmentManager 中
    const environment = EnvironmentManager.currentEnvironment();
    environment.set("paths.upload.url", process.env.STORAGE_URL + '/files');
    environment.set("paths.upload.space", process.env.STORAGE_DEFAULT_SPACE);
    environment.set("paths.upload.viewUrl", process.env.STORAGE_URL);
  }

  render() {
    const { children } = this.props;
    return <PersistGate persistor={this.store.persistor} loading={<div>加载组件</div>}>
      <ConfigProvider locale={zhCN}>
        <DndProvider backend={HTML5Backend}>
          {children}
        </DndProvider>
      </ConfigProvider>
    </PersistGate>
  }

}

export default ExtDvaContainer;
