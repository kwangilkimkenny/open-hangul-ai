/**
 * OWPML Class ID 정의
 * hwpx-owpml-model의 ClassID.h를 참고하여 포팅
 */

export const OWPML_HEAD_ID = 0x10000000;
export const OWPML_CORE_ID = 0x20000000;
export const OWPML_PARALIST_ID = 0x30000000;
export const OWPML_BODY_ID = 0x40000000;
export const OWPML_VERSION_ID = 0x50000000;
export const OWPML_APPLICATION_ID = 0x60000000;
export const OWPML_HISTORY_ID = 0x70000000;
export const OWPML_MASTERPAGE_ID = 0x80000000;
export const OWPML_OPF_ID = 0x90000000;
export const OWPML_CONTAINER_ID = 0xa0000000;
export const OWPML_ODF_MANIFEST_ID = 0xb0000000;
export const OWPML_SECURITY_ID = 0xb8000000;
export const OWPML_UNKNOWN_ID = 0xc0000000;
export const OWPML_RDF_ID = 0xd0000000;
export const OWPML_EXTELEMENT_ID = 0xe0000000;

// Head IDs
export const ID_HEAD_HWPMLHeadType = OWPML_HEAD_ID + 0x0001;
export const ID_HEAD_BeginNum = OWPML_HEAD_ID + 0x0002;
export const ID_HEAD_MappingTableType = OWPML_HEAD_ID + 0x0003;
export const ID_HEAD_ForbiddenWordListType = OWPML_HEAD_ID + 0x0004;
export const ID_HEAD_CompatibleDocumentType = OWPML_HEAD_ID + 0x0005;
export const ID_HEAD_Fontfaces = OWPML_HEAD_ID + 0x0006;
export const ID_HEAD_BorderFills = OWPML_HEAD_ID + 0x0007;
export const ID_HEAD_CharProperties = OWPML_HEAD_ID + 0x0008;
export const ID_HEAD_TabProperties = OWPML_HEAD_ID + 0x0009;
export const ID_HEAD_Numberings = OWPML_HEAD_ID + 0x000a;
export const ID_HEAD_Bullets = OWPML_HEAD_ID + 0x000b;
export const ID_HEAD_ParaProperties = OWPML_HEAD_ID + 0x000c;
export const ID_HEAD_Styles = OWPML_HEAD_ID + 0x000d;
export const ID_HEAD_MemoProperties = OWPML_HEAD_ID + 0x000e;
export const ID_HEAD_FontfaceType = OWPML_HEAD_ID + 0x000f;
export const ID_HEAD_BorderFillType = OWPML_HEAD_ID + 0x0010;
export const ID_HEAD_CharShapeType = OWPML_HEAD_ID + 0x0011;
export const ID_HEAD_TabDefType = OWPML_HEAD_ID + 0x0012;
export const ID_HEAD_NumberingType = OWPML_HEAD_ID + 0x0013;
export const ID_HEAD_BulletType = OWPML_HEAD_ID + 0x0014;
export const ID_HEAD_ParaShapeType = OWPML_HEAD_ID + 0x0015;
export const ID_HEAD_StyleType = OWPML_HEAD_ID + 0x0016;
export const ID_HEAD_MemoShapeType = OWPML_HEAD_ID + 0x0017;
export const ID_HEAD_Font = OWPML_HEAD_ID + 0x0018;
export const ID_HEAD_SubstFont = OWPML_HEAD_ID + 0x0019;
export const ID_HEAD_TypeInfo = OWPML_HEAD_ID + 0x001a;
export const ID_HEAD_SlashType = OWPML_HEAD_ID + 0x001b;
export const ID_HEAD_BorderType = OWPML_HEAD_ID + 0x001c;
export const ID_HEAD_FontRef = OWPML_HEAD_ID + 0x001d;
export const ID_HEAD_Ratio = OWPML_HEAD_ID + 0x001e;
export const ID_HEAD_Spacing = OWPML_HEAD_ID + 0x001f;
export const ID_HEAD_RelSz = OWPML_HEAD_ID + 0x0020;
export const ID_HEAD_Offset = OWPML_HEAD_ID + 0x0021;
export const ID_HEAD_Italic = OWPML_HEAD_ID + 0x0022;
export const ID_HEAD_Bold = OWPML_HEAD_ID + 0x0023;
export const ID_HEAD_Underline = OWPML_HEAD_ID + 0x0024;
export const ID_HEAD_Strikeout = OWPML_HEAD_ID + 0x0025;
export const ID_HEAD_Outline = OWPML_HEAD_ID + 0x0026;
export const ID_HEAD_CharShadow = OWPML_HEAD_ID + 0x0027;
export const ID_HEAD_Emboss = OWPML_HEAD_ID + 0x0028;
export const ID_HEAD_Engrave = OWPML_HEAD_ID + 0x0029;
export const ID_HEAD_Supscript = OWPML_HEAD_ID + 0x002a;
export const ID_HEAD_Subscript = OWPML_HEAD_ID + 0x002b;
export const ID_HEAD_TabItem = OWPML_HEAD_ID + 0x002c;
export const ID_HEAD_ParaHeadType = OWPML_HEAD_ID + 0x002d;
export const ID_HEAD_Align = OWPML_HEAD_ID + 0x002e;
export const ID_HEAD_Heading = OWPML_HEAD_ID + 0x002f;
export const ID_HEAD_BreakSetting = OWPML_HEAD_ID + 0x0030;
export const ID_HEAD_Margin = OWPML_HEAD_ID + 0x0031;
export const ID_HEAD_LineSpacing = OWPML_HEAD_ID + 0x0032;
export const ID_HEAD_Border = OWPML_HEAD_ID + 0x0033;
export const ID_HEAD_AutoSpacing = OWPML_HEAD_ID + 0x0034;
export const ID_HEAD_String = OWPML_HEAD_ID + 0x0035;
export const ID_HEAD_LayoutCompatibility = OWPML_HEAD_ID + 0x0036;

// Para IDs (일부만 정의, 필요시 추가)
export const ID_PARA_SectionType = OWPML_PARALIST_ID + 0x0001;
export const ID_PARA_PType = OWPML_PARALIST_ID + 0x0002;
export const ID_PARA_RunType = OWPML_PARALIST_ID + 0x0003;
export const ID_PARA_T = OWPML_PARALIST_ID + 0x0004;
export const ID_PARA_Char = OWPML_PARALIST_ID + 0x0005;
export const ID_PARA_LineSeg = OWPML_PARALIST_ID + 0x0006;
export const ID_PARA_TableType = OWPML_PARALIST_ID + 0x0007;
export const ID_PARA_PictureType = OWPML_PARALIST_ID + 0x0008;
export const ID_PARA_EquationType = OWPML_PARALIST_ID + 0x0009;
export const ID_PARA_Bookmark = OWPML_PARALIST_ID + 0x000a;
export const ID_PARA_FieldBegin = OWPML_PARALIST_ID + 0x000b;
export const ID_PARA_FieldEnd = OWPML_PARALIST_ID + 0x000c;

// Body IDs
export const ID_BODY_SectionDefinitionType = OWPML_BODY_ID + 0x0001;

// Version IDs
export const ID_VERSION_Version = OWPML_VERSION_ID + 0x0001;

// Application IDs
export const ID_APPLICATION_HWPApplicationSetting = OWPML_APPLICATION_ID + 0x0001;

// History IDs
export const ID_HISTORY_HWPMLHistoryType = OWPML_HISTORY_ID + 0x0001;

// MasterPage IDs
export const ID_MASTERPAGE_MasterPageType = OWPML_MASTERPAGE_ID + 0x0001;

// OPF IDs
export const ID_OPF_Package = OWPML_OPF_ID + 0x0001;
export const ID_OPF_Metadata = OWPML_OPF_ID + 0x0002;
export const ID_OPF_Manifest = OWPML_OPF_ID + 0x0003;
export const ID_OPF_Spine = OWPML_OPF_ID + 0x0004;

// Container IDs
export const ID_CONTAINER_Container = OWPML_CONTAINER_ID + 0x0001;
export const ID_CONTAINER_RootFiles = OWPML_CONTAINER_ID + 0x0002;
export const ID_CONTAINER_RootFile = OWPML_CONTAINER_ID + 0x0003;

