import { routerRedux } from 'dva';
import { parse } from 'qs';
import { Effect, Reducer, Subscription } from 'umi';

import { client } from '../../apollo';
import tokenHelper from '../../apollo/TokenHelper';
import { viewer as LOAD_CURRENTUSER } from '../gql/auth.gql';
import { reloadAuthorized } from '@asany/components';

export function getPageQuery() {
  return parse(window.location.href.split('?')[1]);
}

interface NetworkError extends Error {
  statusCode: number;
}

async function loadCurrentuser() {
  const {
    data: { viewer },
  } = await client.query({
    query: LOAD_CURRENTUSER,
    fetchPolicy: 'no-cache',
  });
  return viewer;
}

export interface CurrentUser {
  /**
   * 用户ID
   */
  uid: string;
  /**
   * 名称
   */
  name: string;
  /**
   * 称号
   */
  title: string;
  /**
   * 头像
   */
  avatar: any;
  /**
   * 邮箱
   */
  email: string;
  /**
   * 签名
   */
  signature: string;
  /**
   * 组名
   */
  group: string;
  /**
   * 电话
   */
  phone: string;
  /**
   * 权限
   */
  authoritys: [string];

  permissions: any[];
  /**
   * 组织
   */
  organization: any;
  /**
   * 部门
   */
  department: any;
  departments: any;
  positions: any;
  jobNumber: string;
  token: string;
}

export interface TokenCredential {
  token: string;
  authority: string[];
}

type LoginStatus = 'ok' | 'pending' | 'error';

export interface AuthModelState {
  status?: LoginStatus;
  currentUser?: CurrentUser;
  credential?: TokenCredential;
}

export interface AuthModelType {
  namespace: 'auth';
  state: AuthModelState;
  effects: {
    logout: Effect;
    loadCurrentUser: Effect;
    loginWithUsername: Effect;
    logonWithLocalStorage: Effect;
    watchToken: Effect;
    redirect: Effect;
  };
  reducers: {
    saveCredential: Reducer<AuthModelState>;
    changeLoginStatus: Reducer<AuthModelState>;
  };
  subscriptions: { setup: Subscription };
}

const AuthModel: AuthModelType = {
  namespace: 'auth',

  state: {
    status: 'pending',
    currentUser: undefined,
    credential: undefined,
  },

  effects: {
    *logout(_: any, { put }: any) {
      // 清理凭证
      yield put({ type: 'saveCredential' });
      // 清理用户
      yield put({
        type: 'changeLoginStatus',
        payload: {
          status: 'pending',
          currentUser: undefined,
          credential: undefined,
        },
      });
      // 跳转登录页
      yield put({ type: 'redirect' });
    },
    *loadCurrentUser(_: any, { select, call, put }: any) {
      try {
        const user = yield call(loadCurrentuser);
        yield put({
          type: 'changeLoginStatus',
          payload: {
            status: 'ok',
            currentUser: user,
            credential: {
              authority: user.authoritys,
            },
          },
        });
      } catch (e) {
        const { graphQLErrors } = e;
        if (graphQLErrors && graphQLErrors.some((error: NetworkError) => error.statusCode === 401)) {
          yield put({ type: 'logout' });
        }
      }
    },
    *loginWithUsername({ payload: user }: any, { put, take }: any) {
      try {
        yield put({
          type: 'changeLoginStatus',
          payload: {
            status: 'pending',
          },
        });
        // 获取凭证
        yield put({
          type: 'saveCredential',
          payload: {
            token: user.token,
            authority: user.authoritys,
          },
        });
        // 获取用户
        yield put({ type: 'loadCurrentUser' });
        // 登录后跳转
        yield take("changeLoginStatus");
        yield put({ type: 'redirect' });
      } catch (e) {
        console.error(e);
        yield put({ type: 'changeLoginStatus', payload: { status: 'error' } });
        throw e;
      }
    },
    *logonWithLocalStorage(_: any, { put }: any) {
      try {
        yield put({
          type: 'changeLoginStatus',
          payload: {
            status: 'pending',
          },
        });
        const json = localStorage.getItem('loginCredentials');
        if (!json) {
          throw '未发现 Token 信息'
        }
        const loginCredentials = JSON.parse(json);
        // 获取凭证
        yield put({
          type: 'saveCredential',
          payload: loginCredentials,
        });
        // 获取用户
        yield put({ type: 'loadCurrentUser' });
      } catch (e) {
        console.error(e);
        yield put({ type: 'changeLoginStatus', payload: { status: 'error' } });
        throw e;
      }
    },
    *redirect(_: any, { put }: any) {
      const urlParams = new URL(window.location.href);
      const params = getPageQuery();
      let { redirect = window.location.origin } = params as any || {};
      if (redirect) {
        const redirectUrlParams = new URL(redirect.startsWith(window.location.origin) ? redirect : window.location.origin + redirect);
        if (redirectUrlParams.origin === urlParams.origin) {
          redirect = redirect.substr(urlParams.origin.length);
          if (redirect.match(/^\/.*#/)) {
            redirect = redirect.substr(0, redirect.indexOf('#') + 1);
          }
        } else {
          window.location.href = redirect;
          return;
        }
      }
      yield put(routerRedux.replace(redirect || '/'));
    },
    *watchToken(_: any, { take, select }: any) {
      while (true) {
        yield take("saveCredential");
        const credential = yield select((state: any) => state.auth.credential);
        if (credential) {
          tokenHelper.setToken(credential.token);
        } else {
          tokenHelper.resetToken();
        }
      }
    }
  },

  reducers: {
    saveCredential(state: any, { payload }: any) {
      if (payload) {
        localStorage.setItem('loginCredentials', JSON.stringify(payload));
      } else {
        localStorage.removeItem('loginCredentials');
      }
      return { ...state, credential: payload };
    },
    changeLoginStatus(state: any, { payload }: any) {
      const { status, currentUser, credential } = payload;
      try {
        switch (status) {
          case 'ok':
            return { ...state, status, currentUser, credential: { ...state.credential, ...credential } };
          case 'pending':
            return { ...state, status, currentUser: null };
          default:
            return { ...state, status };
        }
      } finally {
        reloadAuthorized()
      }
    },
  },
  subscriptions: {
    async setup({ dispatch, history }) {
      dispatch({ type: 'watchToken' });
      dispatch({ type: 'logonWithLocalStorage' });
      history.listen(({ pathname, search }): void => {
        if (pathname === '/logout') {
          dispatch({ type: 'logout' });
        }
      });
    },
  },
};

export default AuthModel;
