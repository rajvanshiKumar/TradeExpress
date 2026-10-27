import useAuth from '../../hooks/useAuth';
import useProducts from '../../hooks/useProducts';

/** The company that the signed-in supplier manages, plus its products. */
export default function useSupplierCompany() {
  const { user } = useAuth();
  const { getCompany, products, loading } = useProducts();
  const company = user?.companyId ? getCompany(user.companyId) : null;
  const companyProducts = company ? products.filter((product) => product.companyId === company.id) : [];
  return { company, companyProducts, loading };
}
