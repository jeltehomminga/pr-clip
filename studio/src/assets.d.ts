// Webpack bundles these as asset/resource: the default export is the file's URL.
declare module "*.ttf" {
  const url: string
  export default url
}

declare module "*.wav" {
  const url: string
  export default url
}

declare module "*.svg" {
  const url: string
  export default url
}
