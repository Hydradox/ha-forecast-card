// Used by the "PR commits" check (.github/workflows/pr-title.yml). Only the format matters (type, subject):
// long body or footer lines are allowed, since bot commits (Dependabot, release notes) have them.
export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "body-max-line-length": [0],
    "footer-max-line-length": [0],
  },
};
