/// The logged-in Employee's own granted permissions (Phase 38) — purely a
/// UX convenience to show/hide entry points (e.g. "Bon d'entrée"); the real
/// enforcement always happens server-side, never here.
class EmployeePermissions {
  EmployeePermissions({
    this.canSeeClientPhone = false,
    this.canSeeClientAddress = false,
    this.canCreateBonEntree = false,
    this.canModifierPrixAchat = false,
    this.canVoirPrixVente = false,
    this.canCreerProduit = false,
    this.canCreerFournisseur = false,
    this.canModifierProduit = false,
    this.canModifierBonApresConfirmation = false,
  });

  final bool canSeeClientPhone;
  final bool canSeeClientAddress;
  final bool canCreateBonEntree;
  final bool canModifierPrixAchat;
  final bool canVoirPrixVente;
  final bool canCreerProduit;
  final bool canCreerFournisseur;
  final bool canModifierProduit;
  final bool canModifierBonApresConfirmation;

  factory EmployeePermissions.fromJson(Map<String, dynamic> json) => EmployeePermissions(
        canSeeClientPhone: json['canSeeClientPhone'] as bool? ?? false,
        canSeeClientAddress: json['canSeeClientAddress'] as bool? ?? false,
        canCreateBonEntree: json['canCreateBonEntree'] as bool? ?? false,
        canModifierPrixAchat: json['canModifierPrixAchat'] as bool? ?? false,
        canVoirPrixVente: json['canVoirPrixVente'] as bool? ?? false,
        canCreerProduit: json['canCreerProduit'] as bool? ?? false,
        canCreerFournisseur: json['canCreerFournisseur'] as bool? ?? false,
        canModifierProduit: json['canModifierProduit'] as bool? ?? false,
        canModifierBonApresConfirmation: json['canModifierBonApresConfirmation'] as bool? ?? false,
      );
}
