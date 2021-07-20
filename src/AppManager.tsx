import React, { ComponentType, useEffect, useReducer, useRef } from 'react';
import { EventEmitter } from 'events';
import { isEqual } from 'lodash';
import RouteComponent, { AuthComponent, RouteWrapperComponent } from './RouteComponent';
import * as utils from '../utils';

export type UseRouteSelectorFunc = <Selected>(
  id: string,
  selector: Selector<Selected>,
  equalityFn?: EqualityFn<Selected>
) => Selected;

export interface IApplication {
  path: string;
}

export interface IRouteComponent {
  template: string;
  props: any[];
  routeWrapper?: {
    template: string;
    props: any[];
  };
}

export interface IRoute {
  id: string;
  path?: string;
  name?: string;
  type: 'menu' | 'header' | 'divider' | 'route' | 'portal';
  component?: IRouteComponent;
  configuration: any;
  application: IApplication;
  authorized: boolean;
  authority: string[];
  wrappers: any[];
  routes: any[] | undefined;
  exact: boolean;
  parent: any;
}

const EVENT_ROUTE_RELOAD = 'EVENT_ROUTE_RELOAD';
const EVENT_SINGLE_ROUTE_UPDATE_PREFIX = 'EVENT_SINGLE_ROUTE_UPDATE_';

type SubscribeCallback = () => void;
export type Selector<Selected> = (state: AppManagerState) => Selected;
export type EqualityFn<Selected> = (a: Selected, b: Selected) => boolean;

const defaultEqualityFn = isEqual;

interface AppManagerState {
  routes: Map<string, IRoute>;
}

export class AppManager {
  private routes = new Map<string, IRoute>();

  private cache = new Map<string, ComponentType<any>>();

  private emitter = new EventEmitter();

  reload() {}

  updateRoute(route: IRoute) {
    this.routes.set(route.id, route);
    this.emitter.emit(EVENT_SINGLE_ROUTE_UPDATE_PREFIX + route.id);
  }

  transform(routes: IRoute[]) {
    this.routes.clear();
    try {
      const routeTree = utils.tree<IRoute>(
        routes.map((item: IRoute) => ({
          ...item,
          routes: [],
        })),
        {
          idKey: 'id',
          childrenKey: 'routes',
          pidKey: 'parent.id',
          sort: (left: any, right: any) => left.index - right.index,
        },
      );
      return routeTree.map(this.transformRoute);
    } finally {
      this.dispatch();
    }
  }

  transformRoute = (route: IRoute) => {
    // 保存数据
    this.routes.set(route.id, route);

    const isParent = route.routes && route.routes.length;
    // 构造组件
    const { component, wrappers } = route.component
      ? this.renderRouteComponent(route.id, route.component)
      : { component: undefined, wrappers: [] as ComponentType<any>[] };

    // 转换子组件
    route.routes = isParent ? route.routes!.map(this.transformRoute) : undefined;

    // 包装器
    if (route.authorized) {
      wrappers.unshift(this.renderAuthorized(route.id));
    }

    // 去除 header / divider 上的关键信息
    if (route.type === 'header' || route.type === 'divider') {
      route.path = '/';
      route.name = route.type === 'header' ? route.name : '--*--';
    }

    if (!route.routes || route.routes.length === 0) {
      route.exact = true;
    }
    return { ...route, component, wrappers };
  };

  private renderRouteComponent(
    id: string,
    { routeWrapper }: IRouteComponent,
  ): {
    component: ComponentType<any>;
    wrappers: ComponentType<any>[];
  } {
    const CACHE_COMPONENT_KEY = `COMPONENT_${  id}`;
    let component = this.cache.get(CACHE_COMPONENT_KEY);
    const wrappers = [];
    if (!component) {
      this.cache.set(
        CACHE_COMPONENT_KEY,
        (component = (props: any) => (
          <RouteComponent useRouteSelector={this.useRouteSelector} ROUTEID={id} {...props} />
        )),
      );
    }
    if (routeWrapper && routeWrapper.template) {
      const CACHE_ROUTEWRAPPER_KEY = `ROUTEWRAPPER_${  id}`;
      let wrapper = this.cache.get(CACHE_ROUTEWRAPPER_KEY);
      if (!wrapper) {
        this.cache.set(
          CACHE_ROUTEWRAPPER_KEY,
          (wrapper = (props: any) => (
            <RouteWrapperComponent useRouteSelector={this.useRouteSelector} ROUTEID={id} {...props} />
          )),
        );
      }
      wrappers.push(wrapper);
    }
    return { component, wrappers };
  }

  private renderAuthorized = (id: string): ComponentType<any> => {
    const CACHE_AUTHCOMPONENT_KEY = `AUTHCOMPONENT_${  id}`;
    let authorized = this.cache.get(CACHE_AUTHCOMPONENT_KEY);
    if (!authorized) {
      this.cache.set(CACHE_AUTHCOMPONENT_KEY, (authorized = (props: any) => <AuthComponent ROUTEID={id}  useRouteSelector={this.useRouteSelector} {...props} />));
    }
    return authorized;
  };

  private dispatch() {
    this.emitter.emit(EVENT_ROUTE_RELOAD);
  }

  private unsubscribe = (callback: SubscribeCallback, id?: string) => () => {
    this.emitter.removeListener(EVENT_ROUTE_RELOAD, callback);
    id && this.emitter.removeListener(EVENT_SINGLE_ROUTE_UPDATE_PREFIX + id, callback);
  };

  subscribe = (callback: SubscribeCallback, id?: string) => {
    this.emitter.addListener(EVENT_ROUTE_RELOAD, callback);
    id && this.emitter.addListener(EVENT_SINGLE_ROUTE_UPDATE_PREFIX + id, callback);
    return this.unsubscribe(callback, id);
  };

  getState = () => ({
    routes: this.routes,
  });

  useRouteSelector: UseRouteSelectorFunc = (
    id: string,
    selector: Selector<any>,
    equalityFn: EqualityFn<any> = defaultEqualityFn,
  ) => {
    const state = this.getState();
    const [, forceRender] = useReducer((s) => s + 1, 0);
    const latestSelectedState = useRef<any>();
    const selectedState = selector(state);
    function checkForUpdates() {
      const newSelectedState = selector(state);
      if (equalityFn(newSelectedState, latestSelectedState.current!)) {
        return;
      }
      latestSelectedState.current = newSelectedState;
      forceRender();
    }
    useEffect(() => {
      return this.subscribe(checkForUpdates, id);
    }, []);
    return selectedState;
  };
}

const manager = new AppManager();

export default manager;

export const useRouteSelector: UseRouteSelectorFunc = manager.useRouteSelector;
