/**
 * Mapeamento RBAC (Role-Based Access Control) do AniTrack
 * Define explicitamente as permissões atribuídas a cada papel de negócio:
 * - otaku: Usuário membro da comunidade (padrão)
 * - critico: Crítico e curador de animes
 * - admin: Administrador e moderador geral da plataforma
 * - usuario: Alias de compatibilidade retroativa com otaku
 */
export const ROLES_PERMISSIONS = {
  otaku: [
    'animes:listar',
    'favoritos:gerenciar_proprio',
    'listas:gerenciar_proprio',
    'comentarios:criar',
    'comentarios:listar',
    'comentarios:excluir_proprio'
  ],
  usuario: [
    'animes:listar',
    'favoritos:gerenciar_proprio',
    'listas:gerenciar_proprio',
    'comentarios:criar',
    'comentarios:listar',
    'comentarios:excluir_proprio'
  ],
  critico: [
    'animes:listar',
    'animes:gerenciar',
    'favoritos:gerenciar_proprio',
    'listas:gerenciar_proprio',
    'comentarios:criar',
    'comentarios:listar',
    'comentarios:excluir_proprio',
    'resenhas:destacar'
  ],
  admin: [
    'animes:listar',
    'animes:gerenciar',
    'favoritos:gerenciar_proprio',
    'listas:gerenciar_proprio',
    'comentarios:criar',
    'comentarios:listar',
    'comentarios:excluir_proprio',
    'comentarios:excluir_qualquer',
    'logs:visualizar'
  ]
};

/**
 * Valida se um papel possui uma determinada permissão.
 * @param {string} role - Papel do usuário ('otaku', 'critico', 'admin', 'usuario')
 * @param {string} permission - Permissão no formato '<recurso>:<acao>'
 * @returns {boolean}
 */
export function hasPermission(role, permission) {
  if (!role || !permission) return false;
  const normalizedRole = role.toLowerCase() === 'usuario' ? 'otaku' : role.toLowerCase();
  const permissions = ROLES_PERMISSIONS[normalizedRole] || ROLES_PERMISSIONS[role.toLowerCase()] || [];
  return permissions.includes(permission);
}

/**
 * Retorna todas as permissões concedidas a um papel.
 * @param {string} role
 * @returns {string[]}
 */
export function getPermissionsForRole(role) {
  if (!role) return [];
  const normalizedRole = role.toLowerCase() === 'usuario' ? 'otaku' : role.toLowerCase();
  return ROLES_PERMISSIONS[normalizedRole] || ROLES_PERMISSIONS[role.toLowerCase()] || [];
}
