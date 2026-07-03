import { basicInfo } from "@docs/basicInfo";
import { servers } from "@docs/servers";
import { tags } from "@docs/tags";
import { components } from "@docs/components";
import { paths } from "@docs/paths";

const openApiDocumentation = {
  ...basicInfo,
  ...servers,
  ...components,
  ...tags,
  ...paths,
};

export { openApiDocumentation };
