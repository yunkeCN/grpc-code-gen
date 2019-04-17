export interface TBase {
  projectId?: number;

  branchOrTag?: string;

  name: string;

  fullName: string;

  comment: string;
}

export interface TField {
  name: string;

  type: string;

  id: number;

  comment: string;

  required: boolean;

  repeated: boolean;

  defaultValue: any;

  bytes: boolean;
}

export interface TMessage extends TBase {
  fields: TField[];

  filename: string | null;
}

export interface TEnum extends TBase {
  values: { [key: string]: any };

  comments: { [key: string]: string };

  filename: string | null;
}

export interface TMethod extends TBase {
  options?: any;

  requestStream?: boolean;

  requestType: string;

  responseStream?: boolean;

  responseType: string;

  type?: string;

  author?: string;
}

export interface TService extends TBase {
  options?: any;

  methods?: TMethod[];

  author: string;

  filename: string | null;
}
