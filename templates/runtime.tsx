import { message } from 'antd';
import { merge } from 'lodash';
import React from 'react';
import { createLogger } from 'redux-logger';
import { persistReducer, persistStore } from 'redux-persist';
import storage from 'redux-persist/lib/storage';

import { client } from '../apollo';
import ExtDvaContainer from './ExtDvaContainer';
import { getApplication as GET_APPLICATION, subscibeUpdateRoute as SUBSCIBE_UPDATEROUTE, getRoute as GET_ROUTE } from './gql/application.gql';
import { setCurrentApplication } from './models/global';
import { AppManager, EnvironmentManager } from '@asany/components';

const logging = process.env.NODE_ENV === 'development';

interface IApplication {
  path: string;
}

interface IRoute {
  path?: string;
  name?: string;
  type: 'menu' | 'header' | 'divider' | 'route';
  component: any | React.SFC<any>;
  configuration: any;
  application: IApplication;
  authorized: boolean;
  authority: string[];
  wrappers: any[];
  routes: any[] | undefined;
  exact: boolean;
  parent: any;
}

const authRoutes = {};
let extraRoutes: any[] = [];

function ergodicRoutes(routes: any[], authKey: any, authority: any) {
  routes.forEach((element) => {
    if (element.path === authKey) {
      if (!element.authority) element.authority = []; // eslint-disable-line
      Object.assign(element.authority, authority || []);
    } else if (element.routes) {
      ergodicRoutes(element.routes, authKey, authority);
    }
    return element;
  });
}

async function loadRoutes() {
  const {
    data: { app },
  } = await client.query({
    query: GET_APPLICATION,
    variables: {
      id: '{{id}}',
    },
    fetchPolicy: 'no-cache'
  });

  setCurrentApplication(app);

  await import('./autoImportLibrary');

  const env = EnvironmentManager.currentEnvironment();

  env.set('layout.navbar.logo', app.logo);
  env.set('layout.navbar.title', app.name);

  extraRoutes = AppManager.transform(app.routes);


  client.subscribe({
    query: SUBSCIBE_UPDATEROUTE,
  }).subscribe({
    async next ({ data }) {
      if(!data.updateRoute){
        console.error('error data -> skip ', data.updateRoute);
        return;
      }
      // TODO 需要判断是否存在与 AppManager 中
      const {
        data: { route },
      } = await client.query({
        query: GET_ROUTE,
        variables: { id: data.updateRoute.id },
        fetchPolicy: 'no-cache'
      });
      AppManager.updateRoute(route);
    }
  });

}

export const patchRoutes = ({ routes }: any) => {
  routes.splice(1)
  Object.keys(authRoutes).forEach((authKey) =>
    ergodicRoutes(routes, authKey, authRoutes[authKey].authority),
  );
  merge(routes, extraRoutes);
};

export const rootContainer = (container: any) => {
  return React.createElement(ExtDvaContainer as any, null, container);
}

export const render = (oldRender: () => void) => {
  loadRoutes().then(oldRender);
};

export const onRouteChange = () => {};

const persistConfig = {
  timeout: 1000,  // you can define your time. But is required.
  key: 'root',
  storage,
};

const persistEnhancer = () => (createStore: any) => (reducer: any, initialState: any, enhancer: any) => {
  const store = createStore(persistReducer(persistConfig, reducer), initialState, enhancer);
  const persistor = persistStore(store, null);
  return {
    persistor,
    ...store,
  };
};

export const dva = {
  config: {
    extraEnhancers: [persistEnhancer()],
    onError(e: Error) {
      message.error(e.message, 3);
    },
  },
  plugins: [
    ...(logging ? [{
      onAction: createLogger(),
    }]: []),
  ],
}
