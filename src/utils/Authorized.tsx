import * as utils from '../../utils';
import { RenderAuthorize } from '../../authorized';

const { getAuthority } = utils;

let Authorized = RenderAuthorize(getAuthority());

export const reloadAuthorized = (): void => {
  Authorized = RenderAuthorize(getAuthority());
};

(window as any).reloadAuthorized = reloadAuthorized;

export default Authorized;
